import type {
  CreateDietCommentInput,
  DietCommentDto,
  DietPlanDto,
  UpsertDietPlanInput,
} from '@pt/shared';
import { apiFetch } from '@/lib/api';

export async function fetchMyActiveDietPlan(): Promise<DietPlanDto | null> {
  const plan = await apiFetch<DietPlanDto | undefined>('/me/diet-plan');
  return plan ?? null;
}

export function fetchDietPlansForStudent(studentId: string): Promise<DietPlanDto[]> {
  return apiFetch<DietPlanDto[]>(`/students/${studentId}/diet-plans`);
}

export function createDietPlan(studentId: string, input: UpsertDietPlanInput): Promise<DietPlanDto> {
  return apiFetch<DietPlanDto>(`/students/${studentId}/diet-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateDietPlan(dietId: string, input: UpsertDietPlanInput): Promise<DietPlanDto> {
  return apiFetch<DietPlanDto>(`/diet-plans/${dietId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deactivateDietPlan(dietId: string): Promise<void> {
  return apiFetch<void>(`/diet-plans/${dietId}`, { method: 'DELETE' });
}

export function fetchDietComments(dietId: string): Promise<DietCommentDto[]> {
  return apiFetch<DietCommentDto[]>(`/diet-plans/${dietId}/comments`);
}

export function addDietComment(dietId: string, input: CreateDietCommentInput): Promise<void> {
  return apiFetch<void>(`/diet-plans/${dietId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
