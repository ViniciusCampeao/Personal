import { z } from 'zod';

/**
 * Mirrors the Prisma enums in `schema.prisma`. Duplicated here (not imported from
 * `@prisma/client`) because this package has no dependency on Prisma — it's shared with
 * the web app too.
 */
export const movementPatterns = [
  'HORIZONTAL_PUSH',
  'VERTICAL_PUSH',
  'HORIZONTAL_PULL',
  'VERTICAL_PULL',
  'SQUAT',
  'HINGE',
  'LUNGE',
  'CARRY',
  'ROTATION',
  'ISOLATION',
  'CONDITIONING',
  'MOBILITY',
] as const;
export const movementPatternSchema = z.enum(movementPatterns);

export const equipments = [
  'BARBELL',
  'DUMBBELL',
  'MACHINE',
  'CABLE',
  'SMITH',
  'KETTLEBELL',
  'BODYWEIGHT',
  'BAND',
  'SUSPENSION',
  'MEDICINE_BALL',
  'CARDIO_MACHINE',
  'OTHER',
] as const;
export const equipmentSchema = z.enum(equipments);

export const loadTypes = [
  'EXTERNAL',
  'BODYWEIGHT',
  'BODYWEIGHT_PLUS',
  'TIME',
  'DISTANCE',
  'NONE',
] as const;
export const loadTypeSchema = z.enum(loadTypes);

export const muscleGroups = [
  'CHEST',
  'BACK',
  'SHOULDERS',
  'BICEPS',
  'TRICEPS',
  'FOREARMS',
  'QUADS',
  'HAMSTRINGS',
  'GLUTES',
  'CALVES',
  'ADDUCTORS',
  'ABDUCTORS',
  'ABS',
  'LOWER_BACK',
  'TRAPS',
  'NECK',
  'FULL_BODY',
  'CARDIO',
] as const;
export const muscleGroupSchema = z.enum(muscleGroups);

export const muscleRoles = ['PRIMARY', 'SECONDARY'] as const;
export const muscleRoleSchema = z.enum(muscleRoles);

const exerciseMuscleSchema = z.object({
  muscle: muscleGroupSchema,
  role: muscleRoleSchema,
});

/** Body of `POST /exercises` — a trainer's custom exercise (spec §5). */
export const createExerciseSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto.').max(120),
  description: z.string().trim().max(2000).optional(),
  instructions: z.string().trim().max(4000).optional(),
  cues: z.array(z.string().trim().min(1)).max(20).default([]),
  commonMistakes: z.array(z.string().trim().min(1)).max(20).default([]),
  movementPattern: movementPatternSchema,
  equipment: equipmentSchema,
  loadType: loadTypeSchema.default('EXTERNAL'),
  unilateral: z.boolean().default(false),
  substitutionGroup: z.string().trim().min(1).max(80).optional(),
  /** Object key returned by `POST /media/presign`, not a playable URL. */
  videoUrl: z.string().trim().min(1).max(500).optional(),
  muscles: z.array(exerciseMuscleSchema).min(1, 'Informe ao menos um músculo.'),
});
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;

/** Body of `PATCH /exercises/:id` — every field optional, same shape otherwise. */
export const updateExerciseSchema = createExerciseSchema.partial();
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;

/** Query of `GET /exercises` — cursor-based pagination (spec §5). */
export const listExercisesQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  muscle: muscleGroupSchema.optional(),
  equipment: equipmentSchema.optional(),
  pattern: movementPatternSchema.optional(),
  scope: z.enum(['global', 'custom', 'all']).default('all'),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListExercisesQuery = z.infer<typeof listExercisesQuerySchema>;

export interface ExerciseMuscleDto {
  muscle: (typeof muscleGroups)[number];
  role: (typeof muscleRoles)[number];
}

export interface ExerciseDto {
  id: string;
  tenantId: string | null;
  name: string;
  description: string | null;
  instructions: string | null;
  cues: string[];
  commonMistakes: string[];
  movementPattern: (typeof movementPatterns)[number];
  equipment: (typeof equipments)[number];
  loadType: (typeof loadTypes)[number];
  unilateral: boolean;
  videoUrl: string | null;
  imageUrls: string[];
  substitutionGroup: string | null;
  isActive: boolean;
  muscles: ExerciseMuscleDto[];
}

export interface ListExercisesResponseDto {
  items: ExerciseDto[];
  nextCursor: string | null;
}
