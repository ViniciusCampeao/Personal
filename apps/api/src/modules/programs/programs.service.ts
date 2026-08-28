import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type CreateDayInput,
  type CreateProgramInput,
  type DuplicateProgramInput,
  type ListProgramsQuery,
  type ListProgramsResponseDto,
  type PrescribedExerciseDto,
  type PrescribedSetDto,
  type ProgramDto,
  type ProgramSummaryDto,
  type ReplaceDayExercisesInput,
  type UpdateDayInput,
  type UpdateProgramInput,
  type WorkoutDayDto,
} from '@pt/shared';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

const exerciseTreeInclude = {
  exercise: { select: { id: true, name: true, equipment: true, movementPattern: true } },
  sets: { orderBy: { setNumber: 'asc' as const } },
};

const dayTreeInclude = {
  exercises: { orderBy: { orderIndex: 'asc' as const }, include: exerciseTreeInclude },
};

type WorkoutDayWithTree = Prisma.WorkoutDayGetPayload<{ include: typeof dayTreeInclude }>;
type PrescribedExerciseWithTree = Prisma.PrescribedExerciseGetPayload<{
  include: typeof exerciseTreeInclude;
}>;
type ProgramRow = Prisma.ProgramGetPayload<object>;

@Injectable()
export class ProgramsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  // ---------------------------------------------------------------- ownership

  /** `Program` is tenant-scoped by the Prisma extension — only ownership is manual. */
  private async ownedProgram(id: string, userId: string): Promise<ProgramRow> {
    const program = await this.db.program.findUnique({ where: { id } });
    if (!program || program.trainerId !== userId) {
      throw new NotFoundException('Programa não encontrado.');
    }
    return program;
  }

  /**
   * `WorkoutDay` has no `tenantId` column and isn't in the tenant-scope allowlist (same
   * as `Exercise`/`ExerciseMuscle` in M2) — tenant *and* trainer ownership are both
   * verified by hand via the parent `Program`.
   */
  private async ownedDay(dayId: string, userId: string) {
    const day = await this.db.workoutDay.findUnique({
      where: { id: dayId },
      include: { program: true },
    });
    const tenantId = this.tenantContext.getTenantId();
    if (!day || day.program.tenantId !== tenantId || day.program.trainerId !== userId) {
      throw new NotFoundException('Dia de treino não encontrado.');
    }
    return day;
  }

  private async assertOwnsStudent(studentId: string, userId: string): Promise<void> {
    const student = await this.db.studentProfile.findUnique({ where: { userId: studentId } });
    if (!student || student.trainerId !== userId) {
      throw new NotFoundException('Aluno não encontrado.');
    }
  }

  // ---------------------------------------------------------------- mapping

  private toSummaryDto(program: ProgramRow): ProgramSummaryDto {
    return {
      id: program.id,
      studentId: program.studentId,
      isTemplate: program.isTemplate,
      sourceProgramId: program.sourceProgramId,
      name: program.name,
      goal: program.goal,
      weeks: program.weeks,
      status: program.status,
      startDate: program.startDate?.toISOString() ?? null,
      endDate: program.endDate?.toISOString() ?? null,
      createdAt: program.createdAt.toISOString(),
    };
  }

  private toSetDto(set: Prisma.PrescribedSetGetPayload<object>): PrescribedSetDto {
    return {
      id: set.id,
      setNumber: set.setNumber,
      setType: set.setType,
      repsMin: set.repsMin,
      repsMax: set.repsMax,
      targetLoadKg: set.targetLoadKg,
      targetRir: set.targetRir,
      targetRpe: set.targetRpe,
      targetSeconds: set.targetSeconds,
      targetDistanceM: set.targetDistanceM,
      restSecondsOverride: set.restSecondsOverride,
    };
  }

  private toExerciseDto(exercise: PrescribedExerciseWithTree): PrescribedExerciseDto {
    return {
      id: exercise.id,
      orderIndex: exercise.orderIndex,
      groupKey: exercise.groupKey,
      groupOrder: exercise.groupOrder,
      technique: exercise.technique,
      restSeconds: exercise.restSeconds,
      tempo: exercise.tempo,
      notes: exercise.notes,
      progressionRule: exercise.progressionRule,
      exercise: exercise.exercise,
      sets: exercise.sets.map((set) => this.toSetDto(set)),
    };
  }

  private toDayDto(day: WorkoutDayWithTree): WorkoutDayDto {
    return {
      id: day.id,
      label: day.label,
      name: day.name,
      orderIndex: day.orderIndex,
      notes: day.notes,
      estimatedMinutes: day.estimatedMinutes,
      exercises: day.exercises.map((exercise) => this.toExerciseDto(exercise)),
    };
  }

  private async findDayTree(dayId: string): Promise<WorkoutDayDto> {
    const day = await this.db.workoutDay.findUniqueOrThrow({
      where: { id: dayId },
      include: dayTreeInclude,
    });
    return this.toDayDto(day);
  }

  // ---------------------------------------------------------------- programs

  async list(userId: string, query: ListProgramsQuery): Promise<ListProgramsResponseDto> {
    const where: Prisma.ProgramWhereInput = {
      trainerId: userId,
      ...(query.studentId && { studentId: query.studentId }),
      ...(query.isTemplate !== undefined && { isTemplate: query.isTemplate }),
    };

    const rows = await this.db.program.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: query.limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map((program) => this.toSummaryDto(program)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async findOne(id: string, userId: string): Promise<ProgramDto> {
    const program = await this.ownedProgram(id, userId);
    const days = await this.db.workoutDay.findMany({
      where: { programId: id },
      orderBy: { orderIndex: 'asc' },
      include: dayTreeInclude,
    });
    return {
      ...this.toSummaryDto(program),
      notes: program.notes,
      days: days.map((day) => this.toDayDto(day)),
    };
  }

  async create(userId: string, input: CreateProgramInput): Promise<ProgramDto> {
    const tenantId = this.tenantContext.getTenantId();
    if (input.studentId) {
      await this.assertOwnsStudent(input.studentId, userId);
    }
    const program = await this.db.program.create({
      data: {
        tenantId,
        trainerId: userId,
        studentId: input.studentId ?? null,
        isTemplate: input.isTemplate,
        name: input.name,
        goal: input.goal,
        notes: input.notes,
        weeks: input.weeks,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });
    return { ...this.toSummaryDto(program), notes: program.notes, days: [] };
  }

  async update(id: string, userId: string, input: UpdateProgramInput): Promise<ProgramDto> {
    await this.ownedProgram(id, userId);
    await this.db.program.update({ where: { id }, data: { ...input } });
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.ownedProgram(id, userId);
    await this.db.program.delete({ where: { id } });
  }

  async activate(id: string, userId: string): Promise<ProgramDto> {
    const program = await this.ownedProgram(id, userId);
    if (!program.studentId) {
      throw new ConflictException(
        'Não é possível ativar um template — duplique para um aluno primeiro.',
      );
    }

    await this.db.$transaction([
      this.db.program.updateMany({
        where: {
          studentId: program.studentId,
          trainerId: userId,
          status: 'ACTIVE',
          id: { not: id },
        },
        data: { status: 'ARCHIVED' },
      }),
      this.db.program.update({
        where: { id },
        data: { status: 'ACTIVE', startDate: program.startDate ?? new Date() },
      }),
    ]);

    return this.findOne(id, userId);
  }

  /**
   * Deep-copies the whole tree (days → exercises → sets) in three round trips, one per
   * level, regardless of how many rows exist at each level — well within the "<3s for
   * 4 days / 30 exercises" acceptance criterion. IDs for every new row are generated in
   * application code (`randomUUID()`) up front so child rows can reference their new
   * parent immediately, instead of relying on `createManyAndReturn` preserving insertion
   * order (a real but undocumented Postgres behaviour we'd rather not depend on).
   */
  async duplicate(id: string, userId: string, input: DuplicateProgramInput): Promise<ProgramDto> {
    const source = await this.ownedProgram(id, userId);
    const sourceDays = await this.db.workoutDay.findMany({
      where: { programId: id },
      orderBy: { orderIndex: 'asc' },
      include: dayTreeInclude,
    });

    let targetStudentId: string | null;
    let targetIsTemplate: boolean;
    if (input.asTemplate) {
      targetStudentId = null;
      targetIsTemplate = true;
    } else if (input.studentId) {
      targetStudentId = input.studentId;
      targetIsTemplate = false;
    } else {
      targetStudentId = source.studentId;
      targetIsTemplate = source.isTemplate;
    }
    if (targetStudentId) {
      await this.assertOwnsStudent(targetStudentId, userId);
    }

    const tenantId = this.tenantContext.getTenantId();
    const newProgram = await this.db.program.create({
      data: {
        tenantId,
        trainerId: userId,
        studentId: targetStudentId,
        isTemplate: targetIsTemplate,
        sourceProgramId: source.id,
        name: source.name,
        goal: source.goal,
        notes: source.notes,
        weeks: source.weeks,
        status: 'DRAFT',
      },
    });

    if (sourceDays.length > 0) {
      const dayIds = sourceDays.map(() => randomUUID());
      await this.db.workoutDay.createMany({
        data: sourceDays.map((day, i) => ({
          id: dayIds[i],
          programId: newProgram.id,
          label: day.label,
          name: day.name,
          orderIndex: day.orderIndex,
          notes: day.notes,
          estimatedMinutes: day.estimatedMinutes,
        })),
      });

      const exerciseRows = sourceDays.flatMap((day, dayIndex) =>
        day.exercises.map((exercise) => ({ id: randomUUID(), dayIndex, exercise })),
      );
      if (exerciseRows.length > 0) {
        await this.db.prescribedExercise.createMany({
          data: exerciseRows.map((row) => ({
            id: row.id,
            workoutDayId: dayIds[row.dayIndex],
            exerciseId: row.exercise.exerciseId,
            orderIndex: row.exercise.orderIndex,
            groupKey: row.exercise.groupKey,
            groupOrder: row.exercise.groupOrder,
            technique: row.exercise.technique,
            restSeconds: row.exercise.restSeconds,
            tempo: row.exercise.tempo,
            notes: row.exercise.notes,
            progressionRule: (row.exercise.progressionRule ?? undefined) as
              Prisma.InputJsonValue | undefined,
          })),
        });

        const setRows = exerciseRows.flatMap((row) =>
          row.exercise.sets.map((set) => ({
            prescribedExerciseId: row.id,
            setNumber: set.setNumber,
            setType: set.setType,
            repsMin: set.repsMin,
            repsMax: set.repsMax,
            targetLoadKg: set.targetLoadKg,
            targetRir: set.targetRir,
            targetRpe: set.targetRpe,
            targetSeconds: set.targetSeconds,
            targetDistanceM: set.targetDistanceM,
            restSecondsOverride: set.restSecondsOverride,
          })),
        );
        if (setRows.length > 0) {
          await this.db.prescribedSet.createMany({ data: setRows });
        }
      }
    }

    return this.findOne(newProgram.id, userId);
  }

  // ---------------------------------------------------------------- days

  async createDay(
    programId: string,
    userId: string,
    input: CreateDayInput,
  ): Promise<WorkoutDayDto> {
    await this.ownedProgram(programId, userId);
    const orderIndex =
      input.orderIndex ?? (await this.db.workoutDay.count({ where: { programId } }));
    const day = await this.db.workoutDay.create({
      data: {
        programId,
        label: input.label,
        name: input.name,
        notes: input.notes,
        estimatedMinutes: input.estimatedMinutes,
        orderIndex,
      },
    });
    return { ...this.toDayDto({ ...day, exercises: [] }) };
  }

  async updateDay(dayId: string, userId: string, input: UpdateDayInput): Promise<WorkoutDayDto> {
    await this.ownedDay(dayId, userId);
    await this.db.workoutDay.update({ where: { id: dayId }, data: { ...input } });
    return this.findDayTree(dayId);
  }

  async removeDay(dayId: string, userId: string): Promise<void> {
    await this.ownedDay(dayId, userId);
    await this.db.workoutDay.delete({ where: { id: dayId } });
  }

  async replaceDayExercises(
    dayId: string,
    userId: string,
    input: ReplaceDayExercisesInput,
  ): Promise<WorkoutDayDto> {
    await this.ownedDay(dayId, userId);
    await this.db.prescribedExercise.deleteMany({ where: { workoutDayId: dayId } });

    if (input.length > 0) {
      const exerciseIds = input.map(() => randomUUID());
      try {
        await this.db.prescribedExercise.createMany({
          data: input.map((exercise, i) => ({
            id: exerciseIds[i],
            workoutDayId: dayId,
            exerciseId: exercise.exerciseId,
            orderIndex: exercise.orderIndex,
            groupKey: exercise.groupKey,
            groupOrder: exercise.groupOrder,
            technique: exercise.technique,
            restSeconds: exercise.restSeconds,
            tempo: exercise.tempo,
            notes: exercise.notes,
            progressionRule: (exercise.progressionRule ?? undefined) as
              Prisma.InputJsonValue | undefined,
          })),
        });

        const setRows = input.flatMap((exercise, i) =>
          exercise.sets.map((set) => ({ prescribedExerciseId: exerciseIds[i], ...set })),
        );
        await this.db.prescribedSet.createMany({ data: setRows });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Número de série duplicado para o mesmo exercício.');
        }
        throw error;
      }
    }

    return this.findDayTree(dayId);
  }
}
