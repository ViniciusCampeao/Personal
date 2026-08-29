import type { TodayResponseDto } from '@pt/shared';
import { db, type LocalSession, type LocalSessionExercise, type LocalSet } from '@/lib/db';
import { newUuid } from '@/lib/uuid';
import { enqueue } from '@/features/sync/outbox';
import { flushOutbox } from '@/features/sync/sync-engine';

/** Strips the keys the API's schemas declare `.optional()` — they reject an explicit null. */
function compact<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value != null));
}

/** Fire-and-forget: a write is durable once it is in Dexie, delivery is the loop's job. */
function kick(): void {
  void flushOutbox().catch(() => undefined);
}

export function getActiveSession(): Promise<LocalSession | undefined> {
  return db.sessions.where('status').equals('IN_PROGRESS').first();
}

export function getSession(clientUuid: string): Promise<LocalSession | undefined> {
  return db.sessions.get(clientUuid);
}

export function getSetsOf(sessionClientUuid: string): Promise<LocalSet[]> {
  return db.sets.where('sessionClientUuid').equals(sessionClientUuid).toArray();
}

function snapshotExercises(today: TodayResponseDto): LocalSessionExercise[] {
  // Snapshotted rather than referenced: the workout must stay renderable offline even if
  // the trainer edits the program mid-session.
  return today.exercises
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((exercise) => ({
      prescribedExerciseId: exercise.prescribedExerciseId,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      orderIndex: exercise.orderIndex,
      groupKey: exercise.groupKey,
      groupOrder: exercise.groupOrder,
      technique: exercise.technique,
      restSeconds: exercise.restSeconds,
      tempo: exercise.tempo,
      notes: exercise.notes,
      sets: exercise.sets,
      lastPerformance: exercise.lastPerformance,
      substitutedFrom: null,
    }));
}

export async function startSession(today: TodayResponseDto): Promise<LocalSession> {
  const existing = await getActiveSession();
  if (existing) return existing;
  if (!today.workoutDayId) throw new Error('Não há treino prescrito para hoje.');

  const session: LocalSession = {
    clientUuid: newUuid(),
    serverId: today.openSessionId,
    workoutDayId: today.workoutDayId,
    programId: today.programId,
    dayLabel: today.dayLabel,
    status: 'IN_PROGRESS',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    perceivedEffort: null,
    mood: null,
    notes: null,
    exercises: snapshotExercises(today),
  };

  await db.sessions.add(session);
  await enqueue({
    sessionClientUuid: session.clientUuid,
    type: 'START',
    payload: {
      clientUuid: session.clientUuid,
      workoutDayId: session.workoutDayId,
      startedAt: session.startedAt,
    },
  });
  kick();
  return session;
}

export interface LogSetInputLocal {
  setNumber: number;
  setType?: LocalSet['setType'];
  reps?: number | null;
  loadKg?: number | null;
  rir?: number | null;
  rpe?: number | null;
  seconds?: number | null;
  distanceM?: number | null;
  toFailure?: boolean;
  notes?: string | null;
}

export async function logSet(
  sessionClientUuid: string,
  prescribedExerciseId: string,
  input: LogSetInputLocal,
): Promise<LocalSet> {
  const doneAt = new Date().toISOString();
  const set: LocalSet = {
    clientUuid: newUuid(),
    sessionClientUuid,
    prescribedExerciseId,
    setNumber: input.setNumber,
    setType: input.setType ?? 'WORK',
    reps: input.reps ?? null,
    loadKg: input.loadKg ?? null,
    rir: input.rir ?? null,
    rpe: input.rpe ?? null,
    seconds: input.seconds ?? null,
    distanceM: input.distanceM ?? null,
    toFailure: input.toFailure ?? false,
    doneAt,
    notes: input.notes ?? null,
  };

  await db.sets.add(set);
  await enqueue({
    sessionClientUuid,
    type: 'LOG_SET',
    prescribedExerciseId,
    payload: compact({
      clientUuid: set.clientUuid,
      setNumber: set.setNumber,
      setType: set.setType,
      reps: set.reps,
      loadKg: set.loadKg,
      rir: set.rir,
      rpe: set.rpe,
      seconds: set.seconds,
      distanceM: set.distanceM,
      toFailure: set.toFailure,
      doneAt: set.doneAt,
      notes: set.notes,
    }),
  });
  kick();
  return set;
}

/**
 * Removes a set the student just logged by mistake. Only possible while its outbox item
 * is still queued: the API has no "delete set" endpoint, so once the server accepted it
 * the correction has to be a new set, not an erasure.
 */
export async function undoSet(set: LocalSet): Promise<boolean> {
  const queued = await db.outbox
    .where('sessionClientUuid')
    .equals(set.sessionClientUuid)
    .filter((item) => item.type === 'LOG_SET' && item.payload.clientUuid === set.clientUuid)
    .first();
  if (!queued) return false;

  await db.transaction('rw', db.outbox, db.sets, async () => {
    await db.outbox.delete(queued.id);
    await db.sets.delete(set.clientUuid);
  });
  return true;
}

export async function substituteExercise(
  sessionClientUuid: string,
  prescribedExerciseId: string,
  replacement: { exerciseId: string; exerciseName: string },
  reason: string | null,
): Promise<void> {
  const session = await db.sessions.get(sessionClientUuid);
  if (!session) throw new Error('Sessão não encontrada.');

  const exercises = session.exercises.map((exercise) =>
    exercise.prescribedExerciseId === prescribedExerciseId
      ? {
          ...exercise,
          substitutedFrom: {
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            reason,
          },
          exerciseId: replacement.exerciseId,
          exerciseName: replacement.exerciseName,
          // The previous performance was on a different movement — showing it as the
          // reference for this one would suggest a load the student never lifted.
          lastPerformance: null,
        }
      : exercise,
  );

  await db.sessions.update(sessionClientUuid, { exercises });
  await enqueue({
    sessionClientUuid,
    type: 'SUBSTITUTE',
    prescribedExerciseId,
    payload: compact({ exerciseId: replacement.exerciseId, reason }),
  });
  kick();
}

export interface FinishSessionInputLocal {
  perceivedEffort?: number | null;
  mood?: number | null;
  notes?: string | null;
}

export async function finishSession(
  sessionClientUuid: string,
  input: FinishSessionInputLocal = {},
): Promise<void> {
  const finishedAt = new Date().toISOString();
  await db.sessions.update(sessionClientUuid, {
    status: 'COMPLETED',
    finishedAt,
    perceivedEffort: input.perceivedEffort ?? null,
    mood: input.mood ?? null,
    notes: input.notes ?? null,
  });
  await enqueue({
    sessionClientUuid,
    type: 'FINISH',
    payload: compact({
      finishedAt,
      perceivedEffort: input.perceivedEffort,
      mood: input.mood,
      notes: input.notes,
    }),
  });
  kick();
}

/**
 * Drops workouts that are finished and fully delivered. Without this the device would
 * accumulate every session ever performed, and the history screen reads from the API.
 */
export async function pruneSyncedSessions(): Promise<number> {
  const completed = await db.sessions.where('status').equals('COMPLETED').toArray();
  let removed = 0;

  for (const session of completed) {
    const pending = await db.outbox.where('sessionClientUuid').equals(session.clientUuid).count();
    if (pending > 0) continue;

    await db.transaction('rw', db.sessions, db.sets, async () => {
      await db.sets.where('sessionClientUuid').equals(session.clientUuid).delete();
      await db.sessions.delete(session.clientUuid);
    });
    removed += 1;
  }

  return removed;
}
