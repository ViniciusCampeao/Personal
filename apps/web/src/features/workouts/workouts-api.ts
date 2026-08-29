import type { ListSessionsResponseDto, SessionDto, TodayResponseDto } from '@pt/shared';
import { apiFetch } from '@/lib/api';
import { readTodayCache, TODAY_CACHE_KEY, writeCache } from '@/lib/db';

/**
 * Today's prescription is the one payload the app cannot do without: the student may
 * only open the app once they are already in the gym, with no signal. Every successful
 * fetch is mirrored to IndexedDB, and a failed one falls back to that mirror.
 */
export async function fetchToday(): Promise<TodayResponseDto> {
  try {
    const today = await apiFetch<TodayResponseDto>('/me/today');
    await writeCache(TODAY_CACHE_KEY, today);
    return today;
  } catch (error) {
    const cached = await readTodayCache();
    if (cached) return cached;
    throw error;
  }
}

export function fetchSession(id: string): Promise<SessionDto> {
  return apiFetch<SessionDto>(`/sessions/${id}`);
}

export function fetchStudentSessions(
  studentId: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<ListSessionsResponseDto> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  // `URLSearchParams.size` is Node 19+ and jsdom does not implement it, so the string
  // itself is what decides whether there is a query at all.
  const search = query.toString();
  const suffix = search ? `?${search}` : '';
  return apiFetch<ListSessionsResponseDto>(`/students/${studentId}/sessions${suffix}`);
}
