import { z } from 'zod';

/** Body of `POST /me/check-in` — `weekStart` is always derived server-side, never sent
 * by the client, so a student can't submit against the wrong week. */
export const submitCheckInSchema = z.object({
  sleepQuality: z.number().int().min(1).max(5).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  soreness: z.number().int().min(1).max(5).optional(),
  stress: z.number().int().min(1).max(5).optional(),
  weightKg: z.number().min(0).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type SubmitCheckInInput = z.infer<typeof submitCheckInSchema>;

export const listCheckInsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListCheckInsQuery = z.infer<typeof listCheckInsQuerySchema>;

export interface CheckInDto {
  id: string;
  weekStart: string;
  sleepQuality: number | null;
  energy: number | null;
  soreness: number | null;
  stress: number | null;
  weightKg: number | null;
  notes: string | null;
  createdAt: string;
}

export interface ListCheckInsResponseDto {
  items: CheckInDto[];
  nextCursor: string | null;
}
