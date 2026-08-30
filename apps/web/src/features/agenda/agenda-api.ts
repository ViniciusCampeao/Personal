import type {
  AgendaEventDto,
  UpdateAgendaEventStatusInput,
  UpsertAgendaEventInput,
} from '@pt/shared';
import { apiFetch } from '@/lib/api';

export function fetchAgendaEvents(params: {
  from: string;
  to: string;
  studentId?: string;
}): Promise<AgendaEventDto[]> {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  if (params.studentId) query.set('studentId', params.studentId);
  return apiFetch<AgendaEventDto[]>(`/agenda-events?${query.toString()}`);
}

export function createAgendaEvent(input: UpsertAgendaEventInput): Promise<AgendaEventDto> {
  return apiFetch<AgendaEventDto>('/agenda-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateAgendaEventStatus(
  id: string,
  input: UpdateAgendaEventStatusInput,
): Promise<AgendaEventDto> {
  return apiFetch<AgendaEventDto>(`/agenda-events/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deleteAgendaEvent(id: string): Promise<void> {
  return apiFetch<void>(`/agenda-events/${id}`, { method: 'DELETE' });
}
