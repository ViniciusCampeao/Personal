import { z } from 'zod';
import { type equipments, type movementPatterns } from './exercises';
import { setTypeSchema, type setTypes } from './programs';

/** Mirrors the Prisma `PrType` enum — response-only, never a request field. */
export const prTypes = ['MAX_LOAD', 'MAX_REPS', 'EST_1RM', 'MAX_SET_VOLUME'] as const;

/** Body of `POST /sessions` — always started from today's `WorkoutDay` (M4 plan §2). */
export const startSessionSchema = z.object({
  clientUuid: z.string().uuid(),
  workoutDayId: z.string().uuid(),
  startedAt: z.coerce.date(),
});
export type StartSessionInput = z.infer<typeof startSessionSchema>;

/** Body of `POST /sessions/:id/sets` — idempotent by `clientUuid` (spec §5). */
export const logSetSchema = z.object({
  clientUuid: z.string().uuid(),
  sessionExerciseId: z.string().uuid(),
  setNumber: z.number().int().min(1),
  setType: setTypeSchema.default('WORK'),
  reps: z.number().int().min(0).optional(),
  loadKg: z.number().min(0).optional(),
  rir: z.number().int().min(0).max(10).optional(),
  rpe: z.number().min(0).max(10).optional(),
  seconds: z.number().int().min(0).optional(),
  distanceM: z.number().min(0).optional(),
  toFailure: z.boolean().default(false),
  doneAt: z.coerce.date(),
  notes: z.string().trim().max(1000).optional(),
});
export type LogSetInput = z.infer<typeof logSetSchema>;

/** Body of `PATCH /sessions/:id/exercises/:seId/substitute`. */
export const substituteExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});
export type SubstituteExerciseInput = z.infer<typeof substituteExerciseSchema>;

/** Body of `POST /sessions/:id/finish`. */
export const finishSessionSchema = z.object({
  finishedAt: z.coerce.date(),
  perceivedEffort: z.number().int().min(1).max(10).optional(),
  mood: z.number().int().min(1).max(5).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type FinishSessionInput = z.infer<typeof finishSessionSchema>;

export const createSessionCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comentário vazio.').max(2000),
});
export type CreateSessionCommentInput = z.infer<typeof createSessionCommentSchema>;

export const listSessionsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;

export interface SetLogDto {
  id: string;
  setNumber: number;
  setType: (typeof setTypes)[number];
  reps: number | null;
  loadKg: number | null;
  rir: number | null;
  rpe: number | null;
  seconds: number | null;
  distanceM: number | null;
  toFailure: boolean;
  estimated1rm: number | null;
  doneAt: string;
  notes: string | null;
}

export interface SessionExerciseDto {
  id: string;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  substitutedFromExerciseId: string | null;
  substitutionReason: string | null;
  skipped: boolean;
  notes: string | null;
  sets: SetLogDto[];
}

export interface SessionDto {
  id: string;
  studentId: string;
  programId: string | null;
  workoutDayId: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'SKIPPED';
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  perceivedEffort: number | null;
  mood: number | null;
  notes: string | null;
  totalVolumeKg: number | null;
  exercises: SessionExerciseDto[];
}

export interface ListSessionsResponseDto {
  items: SessionDto[];
  nextCursor: string | null;
}

export interface LastPerformanceDto {
  loadKg: number | null;
  reps: number | null;
  doneAt: string;
}

export interface TodayPrescribedExerciseDto {
  prescribedExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  equipment: (typeof equipments)[number];
  movementPattern: (typeof movementPatterns)[number];
  orderIndex: number;
  groupKey: string | null;
  lastPerformance: LastPerformanceDto | null;
}

export interface TodayResponseDto {
  hasActiveProgram: boolean;
  programId: string | null;
  workoutDayId: string | null;
  dayLabel: string | null;
  /** An `IN_PROGRESS` session for today, if the student already started it. */
  openSessionId: string | null;
  exercises: TodayPrescribedExerciseDto[];
}

export interface PersonalRecordDto {
  id: string;
  exerciseId: string;
  type: (typeof prTypes)[number];
  value: number;
  reps: number | null;
  achievedAt: string;
}

/**
 * `POST /sessions/sync` (spec §9) — batch replay of the offline outbox. Items
 * reference the session by `sessionClientUuid` (not the server-assigned `id`, which
 * the offline client never saw) and the exercise by `prescribedExerciseId` (stable
 * across substitution, and already known client-side from a pre-fetched `/me/today`) —
 * both get resolved server-side, in item order, within the same batch.
 */
export const syncItemTypes = ['START', 'LOG_SET', 'SUBSTITUTE', 'FINISH'] as const;

const startSyncItemSchema = z.object({
  type: z.literal('START'),
  payload: startSessionSchema,
});

const logSetSyncItemSchema = z.object({
  type: z.literal('LOG_SET'),
  sessionClientUuid: z.string().uuid(),
  prescribedExerciseId: z.string().uuid(),
  payload: logSetSchema.omit({ sessionExerciseId: true }),
});

const substituteSyncItemSchema = z.object({
  type: z.literal('SUBSTITUTE'),
  sessionClientUuid: z.string().uuid(),
  prescribedExerciseId: z.string().uuid(),
  payload: substituteExerciseSchema,
});

const finishSyncItemSchema = z.object({
  type: z.literal('FINISH'),
  sessionClientUuid: z.string().uuid(),
  payload: finishSessionSchema,
});

export const syncItemSchema = z.discriminatedUnion('type', [
  startSyncItemSchema,
  logSetSyncItemSchema,
  substituteSyncItemSchema,
  finishSyncItemSchema,
]);
export type SyncItemInput = z.infer<typeof syncItemSchema>;

export const syncSessionsSchema = z.object({
  items: z.array(syncItemSchema).min(1).max(200),
});
export type SyncSessionsInput = z.infer<typeof syncSessionsSchema>;

export interface SyncItemResultDto {
  index: number;
  type: (typeof syncItemTypes)[number];
  status: 'OK' | 'ERROR';
  sessionId?: string;
  error?: string;
}

export interface SyncSessionsResponseDto {
  results: SyncItemResultDto[];
}
