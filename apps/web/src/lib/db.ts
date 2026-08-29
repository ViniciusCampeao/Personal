import Dexie, { type EntityTable } from 'dexie';
import type { LastPerformanceDto, PrescribedSetDto, TodayResponseDto } from '@pt/shared';

/**
 * Local mirror of a workout in progress.
 *
 * During execution this — not the API — is the source of truth: the gym has no signal,
 * and the screen must render instantly from what the device already knows. Everything
 * the server needs is replayed later from the outbox, keyed by `clientUuid` so a replay
 * is idempotent (the API resolves sessions and sets by that uuid, never by row id).
 */
export interface LocalSessionExercise {
  prescribedExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  /** Non-null when the exercise is part of a bi-set/circuit block. */
  groupKey: string | null;
  groupOrder: number | null;
  technique: string;
  restSeconds: number | null;
  tempo: string | null;
  notes: string | null;
  /** What was prescribed: how many sets, in what rep range, at what target load. */
  sets: PrescribedSetDto[];
  lastPerformance: LastPerformanceDto | null;
  /** Set when the student swapped the prescribed movement for another one. */
  substitutedFrom: { exerciseId: string; exerciseName: string; reason: string | null } | null;
}

export interface LocalSession {
  clientUuid: string;
  /** Assigned once the START item reaches the server; null while offline. */
  serverId: string | null;
  workoutDayId: string;
  programId: string | null;
  dayLabel: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED';
  startedAt: string;
  finishedAt: string | null;
  perceivedEffort: number | null;
  mood: number | null;
  notes: string | null;
  exercises: LocalSessionExercise[];
}

export interface LocalSet {
  clientUuid: string;
  sessionClientUuid: string;
  prescribedExerciseId: string;
  setNumber: number;
  setType: 'WARMUP' | 'WORK' | 'DROP' | 'FAILURE' | 'BACKOFF';
  reps: number | null;
  loadKg: number | null;
  rir: number | null;
  rpe: number | null;
  seconds: number | null;
  distanceM: number | null;
  toFailure: boolean;
  doneAt: string;
  notes: string | null;
}

export type OutboxItemType = 'START' | 'LOG_SET' | 'SUBSTITUTE' | 'FINISH';

/**
 * One queued write, in the exact shape `POST /sessions/sync` expects. Items of the same
 * session must reach the server in insertion order — a set cannot be logged before the
 * session that owns it exists — which is why the queue is an auto-incrementing log and
 * not a set of independent jobs.
 */
export interface OutboxItem {
  id: number;
  sessionClientUuid: string;
  type: OutboxItemType;
  /** Identifies the exercise for LOG_SET/SUBSTITUTE; stable across substitutions. */
  prescribedExerciseId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  /** Epoch ms; an item is only sent once the clock passes it (exponential backoff). */
  retryAt: number;
  /** Set after too many rejections: the item stops blocking, the user gets told. */
  failed: 0 | 1;
  lastError: string | null;
}

/** Small key/value area for prefetched payloads the execution screen needs offline. */
export interface CacheEntry {
  key: string;
  fetchedAt: string;
  value: unknown;
}

export const TODAY_CACHE_KEY = 'me/today';

const db = new Dexie('pt-offline') as Dexie & {
  sessions: EntityTable<LocalSession, 'clientUuid'>;
  sets: EntityTable<LocalSet, 'clientUuid'>;
  outbox: EntityTable<OutboxItem, 'id'>;
  cache: EntityTable<CacheEntry, 'key'>;
};

db.version(1).stores({
  sessions: 'clientUuid, status, startedAt',
  sets: 'clientUuid, sessionClientUuid, [sessionClientUuid+prescribedExerciseId]',
  outbox: '++id, sessionClientUuid, retryAt, failed',
  cache: 'key',
});

export { db };

export async function readCache<T>(key: string): Promise<T | null> {
  const entry = await db.cache.get(key);
  return entry ? (entry.value as T) : null;
}

export async function writeCache(key: string, value: unknown): Promise<void> {
  await db.cache.put({ key, value, fetchedAt: new Date().toISOString() });
}

export function readTodayCache(): Promise<TodayResponseDto | null> {
  return readCache<TodayResponseDto>(TODAY_CACHE_KEY);
}

/**
 * Wipes every table. Called on logout: the database is shared by whoever uses the
 * device, and one student's workout must never surface under another's account.
 */
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', db.sessions, db.sets, db.outbox, db.cache, async () => {
    await Promise.all([db.sessions.clear(), db.sets.clear(), db.outbox.clear(), db.cache.clear()]);
  });
}
