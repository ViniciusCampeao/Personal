import { Inject, Injectable } from '@nestjs/common';
import { type Prisma, Role } from '@prisma/client';
import {
  countsTowardsTonnage,
  setVolumeKg,
  suggestNextLoad,
  type AdherenceQuery,
  type AdherenceWeekDto,
  type ExerciseProgressPointDto,
  type PersonalRecordDto,
  type ProgressionSuggestionDto,
  type ProgressVolumeQuery,
  type VolumeByMuscleDto,
} from '@pt/shared';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { StudentAccessService } from '../../common/students/student-access.service';
import { mondayOfUtc, startOfWeekUtc } from '../../common/util/week';

const prescribedExerciseWithTargetsInclude = {
  exercise: { select: { id: true, name: true, equipment: true, movementPattern: true } },
  sets: true,
};

type PrescribedExerciseWithTargets = Prisma.PrescribedExerciseGetPayload<{
  include: typeof prescribedExerciseWithTargetsInclude;
}>;
type PrescribedSetRow = Prisma.PrescribedSetGetPayload<object>;

@Injectable()
export class ProgressService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly studentAccess: StudentAccessService,
  ) {}

  async exerciseSeries(
    studentId: string,
    exerciseId: string,
    callerUserId: string,
    callerRole: Role,
  ): Promise<ExerciseProgressPointDto[]> {
    await this.studentAccess.assertCanAccessStudent(studentId, callerUserId, callerRole);

    const sets = await this.db.setLog.findMany({
      where: { sessionExercise: { exerciseId, session: { studentId } } },
      orderBy: { doneAt: 'asc' },
    });

    return sets.map((set) => ({
      doneAt: set.doneAt.toISOString(),
      setType: set.setType,
      reps: set.reps,
      loadKg: set.loadKg,
      estimated1rm: set.estimated1rm,
      volumeKg: setVolumeKg(set.reps, set.loadKg),
    }));
  }

  async volumeByMuscle(
    studentId: string,
    query: ProgressVolumeQuery,
    callerUserId: string,
    callerRole: Role,
  ): Promise<VolumeByMuscleDto[]> {
    await this.studentAccess.assertCanAccessStudent(studentId, callerUserId, callerRole);

    const since = weeksAgoMondayUtc(query.weeks);
    const sets = await this.db.setLog.findMany({
      where: { doneAt: { gte: since }, sessionExercise: { session: { studentId } } },
      select: {
        doneAt: true,
        reps: true,
        loadKg: true,
        setType: true,
        sessionExercise: {
          select: {
            exercise: {
              select: {
                muscles: {
                  where: { role: 'PRIMARY', ...(query.muscle ? { muscle: query.muscle } : {}) },
                  select: { muscle: true },
                },
              },
            },
          },
        },
      },
    });

    const buckets = new Map<string, VolumeByMuscleDto>();
    for (const set of sets) {
      if (!countsTowardsTonnage(set.setType)) continue;
      const volume = setVolumeKg(set.reps, set.loadKg);
      if (volume <= 0) continue;

      const weekStart = mondayOfUtc(set.doneAt);
      for (const { muscle } of set.sessionExercise.exercise.muscles) {
        const key = `${weekStart}|${muscle}`;
        const existing = buckets.get(key);
        if (existing) {
          existing.volumeKg += volume;
        } else {
          buckets.set(key, { weekStart, muscle, volumeKg: volume });
        }
      }
    }

    return [...buckets.values()].sort(
      (a, b) => a.weekStart.localeCompare(b.weekStart) || a.muscle.localeCompare(b.muscle),
    );
  }

  async adherence(
    studentId: string,
    query: AdherenceQuery,
    callerUserId: string,
    callerRole: Role,
  ): Promise<AdherenceWeekDto[]> {
    await this.studentAccess.assertCanAccessStudent(studentId, callerUserId, callerRole);

    // Spec §6: "esperadas = nº de WorkoutDay do programa ativo" — there is no history of
    // which program was active in past weeks, so the *current* active program's day
    // count is used as the divisor across the whole requested range.
    const activeProgram = await this.db.program.findFirst({
      where: { studentId, status: 'ACTIVE' },
      include: { days: { select: { id: true } } },
    });
    const expectedSessions = activeProgram?.days.length ?? 0;

    const weekStarts: string[] = [];
    const currentMonday = startOfWeekUtc(new Date());
    for (let i = query.weeks - 1; i >= 0; i--) {
      const d = new Date(currentMonday);
      d.setUTCDate(d.getUTCDate() - i * 7);
      weekStarts.push(d.toISOString().slice(0, 10));
    }

    const sessions = await this.db.workoutSession.findMany({
      where: { studentId, status: 'COMPLETED', finishedAt: { gte: new Date(weekStarts[0]) } },
      select: { finishedAt: true },
    });

    const completedByWeek = new Map<string, number>();
    for (const session of sessions) {
      if (!session.finishedAt) continue;
      const week = mondayOfUtc(session.finishedAt);
      completedByWeek.set(week, (completedByWeek.get(week) ?? 0) + 1);
    }

    return weekStarts.map((weekStart) => {
      const completedSessions = completedByWeek.get(weekStart) ?? 0;
      const adherenceRatio = expectedSessions > 0 ? completedSessions / expectedSessions : 0;
      return { weekStart, completedSessions, expectedSessions, adherenceRatio };
    });
  }

  async records(
    studentId: string,
    callerUserId: string,
    callerRole: Role,
  ): Promise<PersonalRecordDto[]> {
    await this.studentAccess.assertCanAccessStudent(studentId, callerUserId, callerRole);

    const rows = await this.db.personalRecord.findMany({
      where: { studentId },
      orderBy: { achievedAt: 'desc' },
      // The name travels with the record: a PR is always shown as "Supino reto — 80 kg",
      // and making every caller resolve the id would be a second round-trip for nothing.
      include: { exercise: { select: { name: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      exerciseName: row.exercise.name,
      type: row.type,
      value: row.value,
      reps: row.reps,
      achievedAt: row.achievedAt.toISOString(),
    }));
  }

  async progressionSuggestions(
    studentId: string,
    callerUserId: string,
    callerRole: Role,
  ): Promise<ProgressionSuggestionDto[]> {
    await this.studentAccess.assertCanAccessStudent(studentId, callerUserId, callerRole);

    const program = await this.db.program.findFirst({
      where: { studentId, status: 'ACTIVE' },
      include: {
        days: {
          include: { exercises: { include: prescribedExerciseWithTargetsInclude } },
        },
      },
    });
    if (!program) return [];

    const suggestions: ProgressionSuggestionDto[] = [];
    for (const day of program.days) {
      for (const pe of day.exercises) {
        const suggestion = await this.suggestionFor(pe, studentId);
        if (suggestion) suggestions.push(suggestion);
      }
    }
    return suggestions;
  }

  /**
   * Double progression (spec §6), evaluated against the exercise's stable
   * `prescribedExerciseId` link — not `exerciseId`, which mutates on substitution
   * (M4) — so a substituted exercise doesn't silently drop out of its own history.
   */
  private async suggestionFor(
    pe: PrescribedExerciseWithTargets,
    studentId: string,
  ): Promise<ProgressionSuggestionDto | null> {
    const recentSessionExercises = await this.db.sessionExercise.findMany({
      where: { prescribedExerciseId: pe.id, session: { studentId, status: 'COMPLETED' } },
      orderBy: { session: { finishedAt: 'desc' } },
      take: 2,
      include: { sets: { where: { setType: 'WORK' }, orderBy: { setNumber: 'asc' } } },
    });
    if (recentSessionExercises.length === 0) return null;

    const targetsBySetNumber = new Map<number, PrescribedSetRow>(
      pe.sets.map((set) => [set.setNumber, set]),
    );

    const latest = recentSessionExercises[0];
    const evaluableForIncrease = latest.sets
      .map((set) => ({ set, target: targetsBySetNumber.get(set.setNumber) }))
      .filter(
        (row): row is { set: (typeof latest.sets)[number]; target: PrescribedSetRow } =>
          row.target != null && row.target.repsMax != null && row.target.targetRir != null,
      );
    const metIncreaseCriteria =
      evaluableForIncrease.length > 0 &&
      evaluableForIncrease.every(
        ({ set, target }) =>
          (set.reps ?? -1) >= target.repsMax! && (set.rir ?? -1) >= target.targetRir!,
      );

    let failedMinRepsLastTwoSessions = false;
    if (recentSessionExercises.length === 2) {
      failedMinRepsLastTwoSessions = recentSessionExercises.every((se) =>
        se.sets.some((set) => {
          const target = targetsBySetNumber.get(set.setNumber);
          return target?.repsMin != null && set.reps != null && set.reps < target.repsMin;
        }),
      );
    }

    const lastWorkSet = latest.sets.at(-1);
    const lastLoadKg = lastWorkSet?.loadKg ?? null;
    if (lastLoadKg == null) return null;

    const suggestion = suggestNextLoad({
      movementPattern: pe.exercise.movementPattern,
      equipment: pe.exercise.equipment,
      lastLoadKg,
      metIncreaseCriteria,
      failedMinRepsLastTwoSessions,
    });
    if (suggestion.direction === 'HOLD' || suggestion.suggestedLoadKg == null) return null;

    return {
      prescribedExerciseId: pe.id,
      exerciseId: pe.exerciseId,
      exerciseName: pe.exercise.name,
      equipment: pe.exercise.equipment,
      movementPattern: pe.exercise.movementPattern,
      currentLoadKg: lastLoadKg,
      suggestedLoadKg: suggestion.suggestedLoadKg,
      direction: suggestion.direction,
      pct: suggestion.pct,
    };
  }
}

function weeksAgoMondayUtc(weeks: number): Date {
  const monday = startOfWeekUtc(new Date());
  monday.setUTCDate(monday.getUTCDate() - (weeks - 1) * 7);
  return monday;
}
