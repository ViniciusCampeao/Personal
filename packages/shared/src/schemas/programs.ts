import { z } from 'zod';
import { type equipments, type movementPatterns } from './exercises';

/** Mirrors the Prisma enums in `schema.prisma` — see `exercises.ts` for why duplicated. */
export const programStatuses = ['DRAFT', 'ACTIVE', 'FINISHED', 'ARCHIVED'] as const;
export const programStatusSchema = z.enum(programStatuses);

export const techniques = [
  'NORMAL',
  'BISET',
  'TRISET',
  'CIRCUIT',
  'DROPSET',
  'REST_PAUSE',
  'CLUSTER',
  'AMRAP',
  'PYRAMID',
  'ISOMETRIC',
] as const;
export const techniqueSchema = z.enum(techniques);

export const setTypes = ['WARMUP', 'WORK', 'BACKOFF', 'DROP', 'FAILURE'] as const;
export const setTypeSchema = z.enum(setTypes);

/** Body of `POST /programs` — a student's program, or a reusable template. */
export const createProgramSchema = z
  .object({
    studentId: z.string().uuid().optional(),
    isTemplate: z.boolean().default(false),
    name: z.string().trim().min(2, 'Nome muito curto.').max(120),
    goal: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
    weeks: z.number().int().min(1).max(104).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine((value) => Boolean(value.studentId) !== value.isTemplate, {
    message: 'Informe studentId OU marque isTemplate, nunca os dois nem nenhum.',
    path: ['studentId'],
  });
export type CreateProgramInput = z.infer<typeof createProgramSchema>;

/** Body of `PATCH /programs/:id` — `studentId`/`isTemplate` are immutable; `status`
 * excludes `ACTIVE`, which only happens through `POST /programs/:id/activate`. */
export const updateProgramSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  goal: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  weeks: z.number().int().min(1).max(104).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.enum(['DRAFT', 'FINISHED', 'ARCHIVED']).optional(),
});
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

export const duplicateProgramSchema = z.object({
  studentId: z.string().uuid().optional(),
  asTemplate: z.boolean().optional(),
});
export type DuplicateProgramInput = z.infer<typeof duplicateProgramSchema>;

export const listProgramsQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  // `z.coerce.boolean()` would map the query-string "false" to `true` (JS `Boolean()`
  // coercion) — parse the two literal strings the query string can actually carry.
  isTemplate: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListProgramsQuery = z.infer<typeof listProgramsQuerySchema>;

export const createDaySchema = z.object({
  label: z.string().trim().min(1, 'Informe um rótulo, ex: "A".').max(10),
  name: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  estimatedMinutes: z.number().int().min(1).max(600).optional(),
  orderIndex: z.number().int().min(0).optional(),
});
export type CreateDayInput = z.infer<typeof createDaySchema>;

export const updateDaySchema = createDaySchema.partial();
export type UpdateDayInput = z.infer<typeof updateDaySchema>;

const prescribedSetSchema = z.object({
  setNumber: z.number().int().min(1),
  setType: setTypeSchema.default('WORK'),
  repsMin: z.number().int().min(0).optional(),
  repsMax: z.number().int().min(0).optional(),
  targetLoadKg: z.number().min(0).optional(),
  targetRir: z.number().int().min(0).max(10).optional(),
  targetRpe: z.number().min(0).max(10).optional(),
  targetSeconds: z.number().int().min(0).optional(),
  targetDistanceM: z.number().min(0).optional(),
  restSecondsOverride: z.number().int().min(0).optional(),
});
export type PrescribedSetInput = z.infer<typeof prescribedSetSchema>;

const prescribedExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  orderIndex: z.number().int().min(0),
  /** exercises sharing a value are grouped as a bi-set/tri-set/circuit. */
  groupKey: z.string().trim().min(1).max(80).optional(),
  groupOrder: z.number().int().min(0).optional(),
  technique: techniqueSchema.default('NORMAL'),
  restSeconds: z.number().int().min(0).optional(),
  tempo: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(1000).optional(),
  progressionRule: z.unknown().optional(),
  sets: z.array(prescribedSetSchema).min(1, 'Informe ao menos uma série.'),
});
export type PrescribedExerciseInput = z.infer<typeof prescribedExerciseSchema>;

/** Body of `PUT /days/:id/exercises` — replaces the day's whole exercise list at once. */
export const replaceDayExercisesSchema = z.array(prescribedExerciseSchema);
export type ReplaceDayExercisesInput = z.infer<typeof replaceDayExercisesSchema>;

export interface PrescribedSetDto {
  id: string;
  setNumber: number;
  setType: (typeof setTypes)[number];
  repsMin: number | null;
  repsMax: number | null;
  targetLoadKg: number | null;
  targetRir: number | null;
  targetRpe: number | null;
  targetSeconds: number | null;
  targetDistanceM: number | null;
  restSecondsOverride: number | null;
}

export interface PrescribedExerciseDto {
  id: string;
  orderIndex: number;
  groupKey: string | null;
  groupOrder: number | null;
  technique: (typeof techniques)[number];
  restSeconds: number | null;
  tempo: string | null;
  notes: string | null;
  progressionRule: unknown;
  exercise: {
    id: string;
    name: string;
    equipment: (typeof equipments)[number];
    movementPattern: (typeof movementPatterns)[number];
  };
  sets: PrescribedSetDto[];
}

export interface WorkoutDayDto {
  id: string;
  label: string;
  name: string | null;
  orderIndex: number;
  notes: string | null;
  estimatedMinutes: number | null;
  exercises: PrescribedExerciseDto[];
}

export interface ProgramSummaryDto {
  id: string;
  studentId: string | null;
  isTemplate: boolean;
  sourceProgramId: string | null;
  name: string;
  goal: string | null;
  weeks: number | null;
  status: (typeof programStatuses)[number];
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export interface ProgramDto extends ProgramSummaryDto {
  notes: string | null;
  days: WorkoutDayDto[];
}

export interface ListProgramsResponseDto {
  items: ProgramSummaryDto[];
  nextCursor: string | null;
}
