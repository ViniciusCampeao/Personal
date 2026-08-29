import type {
  CreateDayInput,
  CreateProgramInput,
  DuplicateProgramInput,
  ListProgramsResponseDto,
  ProgramDto,
  ReplaceDayExercisesInput,
  UpdateDayInput,
  UpdateProgramInput,
  WorkoutDayDto,
} from '@pt/shared';
import { apiFetch } from '@/lib/api';

function jsonBody(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export function listPrograms(
  params: { studentId?: string; isTemplate?: boolean; limit?: number } = {},
): Promise<ListProgramsResponseDto> {
  const query = new URLSearchParams();
  if (params.studentId) query.set('studentId', params.studentId);
  if (params.isTemplate != null) query.set('isTemplate', String(params.isTemplate));
  if (params.limit) query.set('limit', String(params.limit));
  const search = query.toString();
  return apiFetch<ListProgramsResponseDto>(`/programs${search ? `?${search}` : ''}`);
}

export function fetchProgram(id: string): Promise<ProgramDto> {
  return apiFetch<ProgramDto>(`/programs/${id}`);
}

export function createProgram(input: CreateProgramInput): Promise<ProgramDto> {
  return apiFetch<ProgramDto>('/programs', jsonBody('POST', input));
}

export function updateProgram(id: string, input: UpdateProgramInput): Promise<ProgramDto> {
  return apiFetch<ProgramDto>(`/programs/${id}`, jsonBody('PATCH', input));
}

export function deleteProgram(id: string): Promise<void> {
  return apiFetch<void>(`/programs/${id}`, { method: 'DELETE' });
}

export function duplicateProgram(id: string, input: DuplicateProgramInput): Promise<ProgramDto> {
  return apiFetch<ProgramDto>(`/programs/${id}/duplicate`, jsonBody('POST', input));
}

export function activateProgram(id: string): Promise<ProgramDto> {
  return apiFetch<ProgramDto>(`/programs/${id}/activate`, { method: 'POST' });
}

export function createDay(programId: string, input: CreateDayInput): Promise<WorkoutDayDto> {
  return apiFetch<WorkoutDayDto>(`/programs/${programId}/days`, jsonBody('POST', input));
}

export function updateDay(dayId: string, input: UpdateDayInput): Promise<WorkoutDayDto> {
  return apiFetch<WorkoutDayDto>(`/days/${dayId}`, jsonBody('PATCH', input));
}

export function deleteDay(dayId: string): Promise<void> {
  return apiFetch<void>(`/days/${dayId}`, { method: 'DELETE' });
}

/** Replaces the day's whole exercise list — the editor always sends the full picture. */
export function replaceDayExercises(
  dayId: string,
  exercises: ReplaceDayExercisesInput,
): Promise<WorkoutDayDto> {
  return apiFetch<WorkoutDayDto>(`/days/${dayId}/exercises`, jsonBody('PUT', exercises));
}
