import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Prisma, PrType, Role } from '@prisma/client';
import { estimate1rm, sessionTonnageKg, setVolumeKg, countsTowardsTonnage } from '@pt/shared';
import {
  type CreateSessionCommentInput,
  type FinishSessionInput,
  type LastPerformanceDto,
  type ListSessionsQuery,
  type ListSessionsResponseDto,
  type LogSetInput,
  type SessionDto,
  type SessionExerciseDto,
  type SetLogDto,
  type StartSessionInput,
  type SubstituteExerciseInput,
  type SyncItemResultDto,
  type SyncSessionsInput,
  type SyncSessionsResponseDto,
  type TodayPrescribedExerciseDto,
  type TodayResponseDto,
} from '@pt/shared';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { ExercisesService } from '../exercises/exercises.service';

const sessionTreeInclude = {
  exercises: {
    orderBy: { orderIndex: 'asc' as const },
    include: {
      exercise: { select: { name: true } },
      sets: { orderBy: { setNumber: 'asc' as const } },
    },
  },
};

type SessionWithTree = Prisma.WorkoutSessionGetPayload<{ include: typeof sessionTreeInclude }>;
type SessionExerciseWithTree = Prisma.SessionExerciseGetPayload<{
  include: { exercise: { select: { name: true } }; sets: true };
}>;
type SetLogRow = Prisma.SetLogGetPayload<object>;

@Injectable()
export class SessionsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly exercises: ExercisesService,
  ) {}

  // ---------------------------------------------------------------- ownership

  /**
   * `WorkoutSession` is tenant-scoped by the Prisma extension. `SessionExercise`/
   * `SetLog` are not (same as `WorkoutDay`/`PrescribedExercise` in M3) — every mutation
   * on them goes through a session already checked here.
   */
  private async ownedSession(id: string, userId: string, role: Role) {
    const session = await this.db.workoutSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Sessão não encontrada.');

    if (role === Role.STUDENT) {
      if (session.studentId !== userId) throw new NotFoundException('Sessão não encontrada.');
    } else {
      const student = await this.db.studentProfile.findUnique({
        where: { userId: session.studentId },
      });
      if (!student || student.trainerId !== userId) {
        throw new NotFoundException('Sessão não encontrada.');
      }
    }
    return session;
  }

  // ---------------------------------------------------------------- mapping

  private toSetLogDto(set: SetLogRow): SetLogDto {
    return {
      id: set.id,
      setNumber: set.setNumber,
      setType: set.setType,
      reps: set.reps,
      loadKg: set.loadKg,
      rir: set.rir,
      rpe: set.rpe,
      seconds: set.seconds,
      distanceM: set.distanceM,
      toFailure: set.toFailure,
      estimated1rm: set.estimated1rm,
      doneAt: set.doneAt.toISOString(),
      notes: set.notes,
    };
  }

  private toSessionExerciseDto(se: SessionExerciseWithTree): SessionExerciseDto {
    return {
      id: se.id,
      exerciseId: se.exerciseId,
      exerciseName: se.exercise.name,
      orderIndex: se.orderIndex,
      substitutedFromExerciseId: se.substitutedFromExerciseId,
      substitutionReason: se.substitutionReason,
      skipped: se.skipped,
      notes: se.notes,
      sets: se.sets.map((set) => this.toSetLogDto(set)),
    };
  }

  private toSessionDto(session: SessionWithTree): SessionDto {
    return {
      id: session.id,
      studentId: session.studentId,
      programId: session.programId,
      workoutDayId: session.workoutDayId,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      finishedAt: session.finishedAt?.toISOString() ?? null,
      durationSeconds: session.durationSeconds,
      perceivedEffort: session.perceivedEffort,
      mood: session.mood,
      notes: session.notes,
      totalVolumeKg: session.totalVolumeKg,
      exercises: session.exercises.map((se) => this.toSessionExerciseDto(se)),
    };
  }

  private async findSessionTree(id: string): Promise<SessionDto> {
    const session = await this.db.workoutSession.findUniqueOrThrow({
      where: { id },
      include: sessionTreeInclude,
    });
    return this.toSessionDto(session);
  }

  // ---------------------------------------------------------------- /me/today

  async today(userId: string): Promise<TodayResponseDto> {
    const empty: TodayResponseDto = {
      hasActiveProgram: false,
      programId: null,
      workoutDayId: null,
      dayLabel: null,
      openSessionId: null,
      exercises: [],
    };

    const program = await this.db.program.findFirst({
      where: { studentId: userId, status: 'ACTIVE' },
    });
    if (!program) return empty;

    const days = await this.db.workoutDay.findMany({
      where: { programId: program.id },
      orderBy: { orderIndex: 'asc' },
    });
    if (days.length === 0) {
      return { ...empty, hasActiveProgram: true, programId: program.id };
    }

    const openSession = await this.db.workoutSession.findFirst({
      where: { programId: program.id, studentId: userId, status: 'IN_PROGRESS' },
      orderBy: { startedAt: 'desc' },
    });

    let targetDay = days[0];
    if (openSession?.workoutDayId) {
      targetDay = days.find((day) => day.id === openSession.workoutDayId) ?? days[0];
    } else {
      const lastCompleted = await this.db.workoutSession.findFirst({
        where: { programId: program.id, studentId: userId, status: 'COMPLETED' },
        orderBy: { finishedAt: 'desc' },
      });
      if (lastCompleted?.workoutDayId) {
        const lastIndex = days.findIndex((day) => day.id === lastCompleted.workoutDayId);
        if (lastIndex >= 0) targetDay = days[(lastIndex + 1) % days.length];
      }
    }

    const prescribed = await this.db.prescribedExercise.findMany({
      where: { workoutDayId: targetDay.id },
      orderBy: { orderIndex: 'asc' },
      include: {
        exercise: { select: { id: true, name: true, equipment: true, movementPattern: true } },
      },
    });

    const exercises: TodayPrescribedExerciseDto[] = [];
    for (const pe of prescribed) {
      const lastSet = await this.db.setLog.findFirst({
        where: { sessionExercise: { exerciseId: pe.exerciseId, session: { studentId: userId } } },
        orderBy: { doneAt: 'desc' },
      });
      const lastPerformance: LastPerformanceDto | null = lastSet
        ? { loadKg: lastSet.loadKg, reps: lastSet.reps, doneAt: lastSet.doneAt.toISOString() }
        : null;

      exercises.push({
        prescribedExerciseId: pe.id,
        exerciseId: pe.exerciseId,
        exerciseName: pe.exercise.name,
        equipment: pe.exercise.equipment,
        movementPattern: pe.exercise.movementPattern,
        orderIndex: pe.orderIndex,
        groupKey: pe.groupKey,
        lastPerformance,
      });
    }

    return {
      hasActiveProgram: true,
      programId: program.id,
      workoutDayId: targetDay.id,
      dayLabel: targetDay.label,
      openSessionId: openSession?.id ?? null,
      exercises,
    };
  }

  // ---------------------------------------------------------------- lifecycle

  async start(userId: string, input: StartSessionInput): Promise<SessionDto> {
    const existing = await this.db.workoutSession.findUnique({
      where: { clientUuid: input.clientUuid },
    });
    if (existing) {
      if (existing.studentId !== userId) throw new NotFoundException('Sessão não encontrada.');
      return this.findSessionTree(existing.id);
    }

    const tenantId = this.tenantContext.getTenantId();
    const day = await this.db.workoutDay.findUnique({
      where: { id: input.workoutDayId },
      include: { program: true, exercises: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!day || day.program.tenantId !== tenantId || day.program.studentId !== userId) {
      throw new NotFoundException('Dia de treino não encontrado.');
    }

    const session = await this.db.workoutSession.create({
      data: {
        tenantId,
        studentId: userId,
        programId: day.programId,
        workoutDayId: day.id,
        clientUuid: input.clientUuid,
        status: 'IN_PROGRESS',
        startedAt: input.startedAt,
      },
    });

    if (day.exercises.length > 0) {
      const sessionExerciseIds = day.exercises.map(() => randomUUID());
      await this.db.sessionExercise.createMany({
        data: day.exercises.map((pe, i) => ({
          id: sessionExerciseIds[i],
          sessionId: session.id,
          prescribedExerciseId: pe.id,
          exerciseId: pe.exerciseId,
          orderIndex: pe.orderIndex,
        })),
      });
    }

    return this.findSessionTree(session.id);
  }

  async findOne(id: string, userId: string, role: Role): Promise<SessionDto> {
    await this.ownedSession(id, userId, role);
    return this.findSessionTree(id);
  }

  async logSet(sessionId: string, userId: string, input: LogSetInput): Promise<SetLogDto> {
    const existing = await this.db.setLog.findUnique({ where: { clientUuid: input.clientUuid } });
    if (existing) return this.toSetLogDto(existing);

    const session = await this.ownedSession(sessionId, userId, Role.STUDENT);
    if (session.status !== 'IN_PROGRESS') {
      throw new ConflictException('A sessão não está em andamento.');
    }

    const sessionExercise = await this.db.sessionExercise.findFirst({
      where: { id: input.sessionExerciseId, sessionId },
    });
    if (!sessionExercise) throw new NotFoundException('Exercício da sessão não encontrado.');

    const estimated1rm =
      input.loadKg != null && input.reps != null ? estimate1rm(input.loadKg, input.reps) : null;

    const setLog = await this.db.setLog.create({
      data: {
        sessionExerciseId: sessionExercise.id,
        clientUuid: input.clientUuid,
        setNumber: input.setNumber,
        setType: input.setType,
        reps: input.reps,
        loadKg: input.loadKg,
        rir: input.rir,
        rpe: input.rpe,
        seconds: input.seconds,
        distanceM: input.distanceM,
        toFailure: input.toFailure,
        estimated1rm,
        doneAt: input.doneAt,
        notes: input.notes,
      },
    });

    return this.toSetLogDto(setLog);
  }

  async substitute(
    sessionId: string,
    sessionExerciseId: string,
    userId: string,
    role: Role,
    input: SubstituteExerciseInput,
  ): Promise<SessionExerciseDto> {
    const session = await this.ownedSession(sessionId, userId, role);
    if (session.status !== 'IN_PROGRESS') {
      throw new ConflictException('A sessão não está em andamento.');
    }

    const sessionExercise = await this.db.sessionExercise.findFirst({
      where: { id: sessionExerciseId, sessionId },
    });
    if (!sessionExercise) throw new NotFoundException('Exercício da sessão não encontrado.');

    // Replaying the same substitution (offline sync retry, spec §9) is a no-op — without
    // this, a second call would treat the already-substituted exercise as the
    // "original" and overwrite `substitutedFromExerciseId` with the wrong value.
    if (sessionExercise.exerciseId === input.exerciseId) {
      const current = await this.db.sessionExercise.findUniqueOrThrow({
        where: { id: sessionExerciseId },
        include: { exercise: { select: { name: true } }, sets: { orderBy: { setNumber: 'asc' } } },
      });
      return this.toSessionExerciseDto(current);
    }

    // Same rule already enforced by `ExercisesService.substitutes()` for
    // `GET /exercises/:id/substitutes` (spec §6) — reused rather than duplicated.
    const candidates = await this.exercises.substitutes(sessionExercise.exerciseId);
    if (!candidates.some((candidate) => candidate.id === input.exerciseId)) {
      throw new UnprocessableEntityException(
        'Esse exercício não é um substituto válido (precisa ser do mesmo grupo de substituição ou ter o mesmo padrão de movimento e músculo primário).',
      );
    }

    const updated = await this.db.sessionExercise.update({
      where: { id: sessionExerciseId },
      data: {
        substitutedFromExerciseId: sessionExercise.exerciseId,
        substitutionReason: input.reason,
        exerciseId: input.exerciseId,
      },
      include: { exercise: { select: { name: true } }, sets: { orderBy: { setNumber: 'asc' } } },
    });

    return this.toSessionExerciseDto(updated);
  }

  async finish(sessionId: string, userId: string, input: FinishSessionInput): Promise<SessionDto> {
    const session = await this.ownedSession(sessionId, userId, Role.STUDENT);
    if (session.status !== 'IN_PROGRESS') {
      throw new ConflictException('A sessão já foi finalizada.');
    }
    await this.applyFinish(session, userId, input);
    return this.findSessionTree(sessionId);
  }

  /**
   * The actual finish write + PR recalculation, shared by the online `finish()` (which
   * only calls this once `IN_PROGRESS` is confirmed) and the sync path's
   * last-write-wins reconciliation (spec §9), which may call this on an already
   * `COMPLETED` session when the incoming data is newer.
   */
  private async applyFinish(
    session: { id: string; startedAt: Date; studentId: string },
    userId: string,
    input: FinishSessionInput,
  ): Promise<void> {
    const sessionExercises = await this.db.sessionExercise.findMany({
      where: { sessionId: session.id },
      include: { sets: true },
    });

    const totalVolumeKg = sessionTonnageKg(
      sessionExercises.flatMap((se) =>
        se.sets.map((set) => ({ setType: set.setType, reps: set.reps, loadKg: set.loadKg })),
      ),
    );
    const durationSeconds = Math.max(
      0,
      Math.round((input.finishedAt.getTime() - session.startedAt.getTime()) / 1000),
    );

    await this.db.workoutSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        finishedAt: input.finishedAt,
        durationSeconds,
        totalVolumeKg,
        perceivedEffort: input.perceivedEffort,
        mood: input.mood,
        notes: input.notes,
      },
    });

    await this.recalculatePersonalRecords(userId, sessionExercises);
  }

  /**
   * Synchronous on purpose (M4 plan, decision #1) — a real BullMQ job is more
   * infrastructure than this lightweight per-session comparison currently needs. Only
   * WORK/BACKOFF sets qualify, same classification `countsTowardsTonnage()` already
   * uses for volume.
   */
  private async recalculatePersonalRecords(
    studentId: string,
    sessionExercises: Array<{ exerciseId: string; sets: SetLogRow[] }>,
  ): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    const setsByExercise = new Map<string, SetLogRow[]>();
    for (const se of sessionExercises) {
      const qualifying = se.sets.filter((set) => countsTowardsTonnage(set.setType));
      if (qualifying.length === 0) continue;
      setsByExercise.set(se.exerciseId, [
        ...(setsByExercise.get(se.exerciseId) ?? []),
        ...qualifying,
      ]);
    }

    for (const [exerciseId, sets] of setsByExercise) {
      const candidates: Array<{
        type: PrType;
        value: number;
        reps: number | null;
        setLogId: string;
      }> = [];

      const byLoad = maxBy(sets, (set) => set.loadKg);
      if (byLoad?.loadKg != null) {
        candidates.push({
          type: PrType.MAX_LOAD,
          value: byLoad.loadKg,
          reps: byLoad.reps,
          setLogId: byLoad.id,
        });
      }

      const byReps = maxBy(sets, (set) => set.reps);
      if (byReps?.reps != null) {
        candidates.push({
          type: PrType.MAX_REPS,
          value: byReps.reps,
          reps: byReps.reps,
          setLogId: byReps.id,
        });
      }

      const byE1rm = maxBy(sets, (set) => set.estimated1rm);
      if (byE1rm?.estimated1rm != null) {
        candidates.push({
          type: PrType.EST_1RM,
          value: byE1rm.estimated1rm,
          reps: byE1rm.reps,
          setLogId: byE1rm.id,
        });
      }

      const byVolume = maxBy(sets, (set) => setVolumeKg(set.reps, set.loadKg));
      const topVolume = byVolume ? setVolumeKg(byVolume.reps, byVolume.loadKg) : 0;
      if (byVolume && topVolume > 0) {
        candidates.push({
          type: PrType.MAX_SET_VOLUME,
          value: topVolume,
          reps: byVolume.reps,
          setLogId: byVolume.id,
        });
      }

      for (const candidate of candidates) {
        const key = { studentId_exerciseId_type: { studentId, exerciseId, type: candidate.type } };
        const existing = await this.db.personalRecord.findUnique({ where: key });
        if (existing && existing.value >= candidate.value) continue;

        await this.db.personalRecord.upsert({
          where: key,
          create: {
            tenantId,
            studentId,
            exerciseId,
            type: candidate.type,
            value: candidate.value,
            reps: candidate.reps,
            setLogId: candidate.setLogId,
            achievedAt: new Date(),
          },
          update: {
            value: candidate.value,
            reps: candidate.reps,
            setLogId: candidate.setLogId,
            achievedAt: new Date(),
          },
        });
      }
    }
  }

  // ---------------------------------------------------------------- history + comments

  async listForStudent(
    studentId: string,
    callerUserId: string,
    callerRole: Role,
    query: ListSessionsQuery,
  ): Promise<ListSessionsResponseDto> {
    if (callerRole === Role.STUDENT) {
      if (studentId !== callerUserId) throw new NotFoundException('Aluno não encontrado.');
    } else {
      const student = await this.db.studentProfile.findUnique({ where: { userId: studentId } });
      if (!student || student.trainerId !== callerUserId) {
        throw new NotFoundException('Aluno não encontrado.');
      }
    }

    const rows = await this.db.workoutSession.findMany({
      where: { studentId },
      orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
      take: query.limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: await Promise.all(page.map((row) => this.findSessionTree(row.id))),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async addComment(
    sessionId: string,
    userId: string,
    role: Role,
    input: CreateSessionCommentInput,
  ): Promise<void> {
    await this.ownedSession(sessionId, userId, role);
    const tenantId = this.tenantContext.getTenantId();
    await this.db.sessionComment.create({
      data: { tenantId, sessionId, authorId: userId, body: input.body },
    });
  }

  // ---------------------------------------------------------------- offline sync (M7)

  /**
   * Batch replay of the offline outbox (spec §9). Items are processed in order (not in
   * parallel) because `LOG_SET`/`SUBSTITUTE`/`FINISH` reference their session by
   * `sessionClientUuid` — resolved here to the real `id`, which only exists once this
   * same batch's own `START` item has run. One bad item becomes an `ERROR` result, it
   * doesn't fail the whole batch.
   */
  async sync(userId: string, input: SyncSessionsInput): Promise<SyncSessionsResponseDto> {
    const results: SyncItemResultDto[] = [];
    const resolvedSessionIds = new Map<string, string>();

    for (let index = 0; index < input.items.length; index += 1) {
      const item = input.items[index];
      try {
        switch (item.type) {
          case 'START': {
            const session = await this.start(userId, item.payload);
            resolvedSessionIds.set(item.payload.clientUuid, session.id);
            results.push({ index, type: item.type, status: 'OK', sessionId: session.id });
            break;
          }
          case 'LOG_SET': {
            const sessionId = await this.resolveSessionId(
              item.sessionClientUuid,
              userId,
              resolvedSessionIds,
            );
            const sessionExercise = await this.resolveSessionExercise(
              sessionId,
              item.prescribedExerciseId,
            );
            await this.logSet(sessionId, userId, {
              ...item.payload,
              sessionExerciseId: sessionExercise.id,
            });
            results.push({ index, type: item.type, status: 'OK', sessionId });
            break;
          }
          case 'SUBSTITUTE': {
            const sessionId = await this.resolveSessionId(
              item.sessionClientUuid,
              userId,
              resolvedSessionIds,
            );
            const sessionExercise = await this.resolveSessionExercise(
              sessionId,
              item.prescribedExerciseId,
            );
            await this.substitute(
              sessionId,
              sessionExercise.id,
              userId,
              Role.STUDENT,
              item.payload,
            );
            results.push({ index, type: item.type, status: 'OK', sessionId });
            break;
          }
          case 'FINISH': {
            const sessionId = await this.resolveSessionId(
              item.sessionClientUuid,
              userId,
              resolvedSessionIds,
            );
            await this.finishFromSync(sessionId, userId, item.payload);
            results.push({ index, type: item.type, status: 'OK', sessionId });
            break;
          }
        }
      } catch (error) {
        results.push({
          index,
          type: item.type,
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Erro desconhecido.',
        });
      }
    }

    return { results };
  }

  private async resolveSessionId(
    sessionClientUuid: string,
    userId: string,
    cache: Map<string, string>,
  ): Promise<string> {
    const cached = cache.get(sessionClientUuid);
    if (cached) return cached;

    const session = await this.db.workoutSession.findUnique({
      where: { clientUuid: sessionClientUuid },
    });
    if (!session || session.studentId !== userId) {
      throw new NotFoundException('Sessão não encontrada.');
    }
    cache.set(sessionClientUuid, session.id);
    return session.id;
  }

  private async resolveSessionExercise(sessionId: string, prescribedExerciseId: string) {
    const sessionExercise = await this.db.sessionExercise.findFirst({
      where: { sessionId, prescribedExerciseId },
    });
    if (!sessionExercise) throw new NotFoundException('Exercício da sessão não encontrado.');
    return sessionExercise;
  }

  /**
   * Spec §9 conflict rule — last-write-wins by `finishedAt` — applies only here, not to
   * the online `POST /sessions/:id/finish` (which still 409s on an already-finished
   * session; a second *online* tap should fail loudly).
   */
  private async finishFromSync(
    sessionId: string,
    userId: string,
    input: FinishSessionInput,
  ): Promise<void> {
    const session = await this.ownedSession(sessionId, userId, Role.STUDENT);
    if (session.status === 'IN_PROGRESS') {
      await this.applyFinish(session, userId, input);
      return;
    }
    if (session.finishedAt && input.finishedAt <= session.finishedAt) return;
    await this.applyFinish(session, userId, input);
  }
}

function maxBy<T>(items: T[], selector: (item: T) => number | null | undefined): T | undefined {
  let best: T | undefined;
  let bestValue = -Infinity;
  for (const item of items) {
    const value = selector(item);
    if (value != null && value > bestValue) {
      best = item;
      bestValue = value;
    }
  }
  return best;
}
