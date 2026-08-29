import { z } from 'zod';
import { type experienceLevels, type sexes } from './me';

/** Mirrors the Prisma `UserStatus` enum. `PAUSED` is how a trainer parks a student. */
export const studentStatuses = ['PENDING', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
export const studentStatusSchema = z.enum(studentStatuses);

/** Query of `GET /students` — the trainer's roster, searchable and filterable (spec §5). */
export const listStudentsQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  status: studentStatusSchema.optional(),
  /** Only students whose adherence over the window is at or below this percentage. */
  maxAdherencePct: z.coerce.number().int().min(0).max(100).optional(),
  /** Only students with no completed session in this many days. */
  inactiveDays: z.coerce.number().int().min(1).max(365).optional(),
  weeks: z.coerce.number().int().min(1).max(52).default(4),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;

/** Body of `PATCH /students/:id` — the fields a trainer owns about their student. */
export const updateStudentSchema = z.object({
  status: studentStatusSchema.optional(),
  goal: z.string().trim().max(500).nullish(),
  privateNotes: z.string().trim().max(4000).nullish(),
  experienceLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  weeklyAvailability: z.number().int().min(1).max(14).nullish(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export interface StudentSummaryDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: (typeof studentStatuses)[number];
  goal: string | null;
  experienceLevel: (typeof experienceLevels)[number];
  startedAt: string;
  /** Null when the student has never completed a session. */
  lastSessionAt: string | null;
  /** Completed over expected across the requested window; 1 means "on plan". */
  adherenceRatio: number;
  activeProgramId: string | null;
  activeProgramName: string | null;
  hasPendingCheckIn: boolean;
}

export interface ListStudentsResponseDto {
  items: StudentSummaryDto[];
  nextCursor: string | null;
}

export interface StudentDetailDto extends StudentSummaryDto {
  birthDate: string | null;
  sex: (typeof sexes)[number] | null;
  heightCm: number | null;
  weeklyAvailability: number | null;
  /** Trainer-only free text; never returned to the student themselves. */
  privateNotes: string | null;
  lastAssessmentAt: string | null;
  totalSessions: number;
}
