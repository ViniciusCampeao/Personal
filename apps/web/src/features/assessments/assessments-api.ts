import type {
  AssessmentCompareDto,
  AssessmentDetailDto,
  ListAssessmentsResponseDto,
} from '@pt/shared';
import { apiFetch } from '@/lib/api';

export function fetchAssessments(
  studentId: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<ListAssessmentsResponseDto> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  const search = query.toString();
  const suffix = search ? `?${search}` : '';
  return apiFetch<ListAssessmentsResponseDto>(`/students/${studentId}/assessments${suffix}`);
}

export function fetchAssessment(id: string): Promise<AssessmentDetailDto> {
  return apiFetch<AssessmentDetailDto>(`/assessments/${id}`);
}

export function compareAssessments(a: string, b: string): Promise<AssessmentCompareDto> {
  return apiFetch<AssessmentCompareDto>(`/assessments/compare?a=${a}&b=${b}`);
}
