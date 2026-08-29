import type { CheckInDto, ListCheckInsResponseDto, SubmitCheckInInput } from '@pt/shared';
import { apiFetch } from '@/lib/api';

/** `{}` (not null) when the week has no check-in yet — the API returns an empty body. */
export async function fetchCurrentCheckIn(): Promise<CheckInDto | null> {
  const current = await apiFetch<CheckInDto | Record<string, never>>('/me/check-in/current');
  return current && 'id' in current ? (current as CheckInDto) : null;
}

export function submitCheckIn(input: SubmitCheckInInput): Promise<CheckInDto> {
  return apiFetch<CheckInDto>('/me/check-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function fetchCheckIns(
  studentId: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<ListCheckInsResponseDto> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  const search = query.toString();
  const suffix = search ? `?${search}` : '';
  return apiFetch<ListCheckInsResponseDto>(`/students/${studentId}/check-ins${suffix}`);
}
