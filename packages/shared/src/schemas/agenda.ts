import { z } from 'zod';

export const agendaEventTypes = ['TRAINING', 'MEETING', 'OTHER'] as const;
export type AgendaEventType = (typeof agendaEventTypes)[number];

export const agendaEventStatuses = ['SCHEDULED', 'DONE', 'CANCELED'] as const;
export type AgendaEventStatus = (typeof agendaEventStatuses)[number];

export const upsertAgendaEventSchema = z.object({
  studentId: z.string().uuid().optional(),
  type: z.enum(agendaEventTypes),
  title: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(1000).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});
export type UpsertAgendaEventInput = z.infer<typeof upsertAgendaEventSchema>;

export const updateAgendaEventStatusSchema = z.object({
  status: z.enum(agendaEventStatuses),
});
export type UpdateAgendaEventStatusInput = z.infer<typeof updateAgendaEventStatusSchema>;

export const listAgendaEventsQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  studentId: z.string().uuid().optional(),
});
export type ListAgendaEventsQuery = z.infer<typeof listAgendaEventsQuerySchema>;

export interface AgendaEventDto {
  id: string;
  studentId: string | null;
  studentName: string | null;
  type: AgendaEventType;
  status: AgendaEventStatus;
  title: string;
  notes: string | null;
  startsAt: string;
  endsAt: string;
}
