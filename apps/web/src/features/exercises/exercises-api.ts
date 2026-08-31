import type { ExerciseDto, ListExercisesResponseDto, RenameExerciseInput } from '@pt/shared';
import { apiFetch } from '@/lib/api';

export interface ListExercisesParams {
  q?: string;
  muscle?: string;
  equipment?: string;
  pattern?: string;
  scope?: 'global' | 'custom' | 'all';
  cursor?: string;
  limit?: number;
}

export function listExercises(params: ListExercisesParams = {}): Promise<ListExercisesResponseDto> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') query.set(key, String(value));
  }
  const search = query.toString();
  const suffix = search ? `?${search}` : '';
  return apiFetch<ListExercisesResponseDto>(`/exercises${suffix}`);
}

export function fetchExercise(id: string): Promise<ExerciseDto> {
  return apiFetch<ExerciseDto>(`/exercises/${id}`);
}

/** Same substitution group and movement pattern — the swaps a trainer would accept. */
export function fetchSubstitutes(id: string): Promise<ExerciseDto[]> {
  return apiFetch<ExerciseDto[]>(`/exercises/${id}/substitutes`);
}

/**
 * The lightweight "just the name" edit (pencil icon in the library). Works for a global
 * exercise too — the API stores it as a private override rather than editing the shared
 * catalogue entry.
 */
export function renameExercise(id: string, name: string): Promise<ExerciseDto> {
  return apiFetch<ExerciseDto>(`/exercises/${id}/name`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name } satisfies RenameExerciseInput),
  });
}
