import { z } from 'zod';

export const dietMealSchema = z.object({
  name: z.string().trim().min(1).max(80),
  time: z.string().trim().max(20).optional(),
  items: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
});
export type DietMealInput = z.infer<typeof dietMealSchema>;

export const upsertDietPlanSchema = z.object({
  title: z.string().trim().min(1).max(120),
  goal: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  meals: z.array(dietMealSchema).max(20).default([]),
});
export type UpsertDietPlanInput = z.infer<typeof upsertDietPlanSchema>;

export interface DietMealDto {
  id: string;
  name: string;
  time: string | null;
  items: string[];
}

export interface DietPlanDto {
  id: string;
  studentId: string;
  trainerId: string;
  title: string;
  goal: string | null;
  notes: string | null;
  active: boolean;
  meals: DietMealDto[];
  createdAt: string;
  updatedAt: string;
}

export const createDietCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comentário vazio.').max(2000),
});
export type CreateDietCommentInput = z.infer<typeof createDietCommentSchema>;

export interface DietCommentDto {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}
