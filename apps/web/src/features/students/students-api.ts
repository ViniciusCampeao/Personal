import type {
  ListStudentsQuery,
  ListStudentsResponseDto,
  StudentDetailDto,
  UpdateStudentInput,
} from '@pt/shared';
import { apiFetch } from '@/lib/api';

export type StudentFilters = Partial<Omit<ListStudentsQuery, 'cursor' | 'limit'>>;

export function listStudents(
  filters: StudentFilters = {},
  page: { cursor?: string; limit?: number } = {},
): Promise<ListStudentsResponseDto> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...page })) {
    if (value != null && value !== '') query.set(key, String(value));
  }
  const search = query.toString();
  const suffix = search ? `?${search}` : '';
  return apiFetch<ListStudentsResponseDto>(`/students${suffix}`);
}

export function fetchStudent(id: string): Promise<StudentDetailDto> {
  return apiFetch<StudentDetailDto>(`/students/${id}`);
}

export function updateStudent(id: string, input: UpdateStudentInput): Promise<StudentDetailDto> {
  return apiFetch<StudentDetailDto>(`/students/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
