import { z } from 'zod';
import {
  type equipments,
  type movementPatterns,
  muscleGroupSchema,
  type muscleGroups,
} from './exercises';
import { type setTypes } from './programs';
import { type ProgressionDirection } from '../calc/progression';

/** Query for `GET /students/:id/progress/volume` and `.../adherence` (spec §5). */
const weeksRangeSchema = z.coerce.number().int().min(1).max(52).default(12);

export const progressVolumeQuerySchema = z.object({
  muscle: muscleGroupSchema.optional(),
  weeks: weeksRangeSchema,
});
export type ProgressVolumeQuery = z.infer<typeof progressVolumeQuerySchema>;

export const adherenceQuerySchema = z.object({
  weeks: weeksRangeSchema,
});
export type AdherenceQuery = z.infer<typeof adherenceQuerySchema>;

export interface ExerciseProgressPointDto {
  doneAt: string;
  setType: (typeof setTypes)[number];
  reps: number | null;
  loadKg: number | null;
  estimated1rm: number | null;
  volumeKg: number;
}

export interface VolumeByMuscleDto {
  weekStart: string;
  muscle: (typeof muscleGroups)[number];
  volumeKg: number;
}

export interface AdherenceWeekDto {
  weekStart: string;
  completedSessions: number;
  expectedSessions: number;
  /**
   * Completed over expected, as a ratio — and it can exceed 1 when a student trains
   * more than the program prescribes. Named `Ratio`, not `Pct`, because reading 0.75
   * as "0.75%" is the mistake this field invites.
   */
  adherenceRatio: number;
}

export interface ProgressionSuggestionDto {
  prescribedExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  equipment: (typeof equipments)[number];
  movementPattern: (typeof movementPatterns)[number];
  currentLoadKg: number;
  suggestedLoadKg: number;
  direction: ProgressionDirection;
  pct: number;
}
