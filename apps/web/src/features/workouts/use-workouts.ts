import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import type { TodayResponseDto } from '@pt/shared';
import { getActiveSession, getSession, getSetsOf } from './workout-store';
import { fetchStudentSessions, fetchToday } from './workouts-api';

export const workoutKeys = {
  today: ['me', 'today'] as const,
  sessions: (studentId: string) => ['students', studentId, 'sessions'] as const,
};

export function useToday() {
  return useQuery<TodayResponseDto>({
    queryKey: workoutKeys.today,
    queryFn: fetchToday,
    // The prescription changes at most once a day; refetching it on every mount would
    // just burn the connection the student may not have.
    staleTime: 5 * 60_000,
  });
}

/**
 * The workout in progress on *this device*, straight from IndexedDB.
 *
 * These hooks resolve to `undefined` while the query is still running and to `null` when
 * the row genuinely does not exist — Dexie reports both as `undefined`, and "still
 * loading" must not be rendered as "workout not found".
 */
export function useActiveSession() {
  return useLiveQuery(async () => (await getActiveSession()) ?? null, [], undefined);
}

export function useLocalSession(clientUuid: string) {
  return useLiveQuery(async () => (await getSession(clientUuid)) ?? null, [clientUuid], undefined);
}

export function useLocalSets(clientUuid: string) {
  return useLiveQuery(() => getSetsOf(clientUuid), [clientUuid], undefined);
}

export function useSessionHistory(studentId: string | undefined) {
  return useInfiniteQuery({
    queryKey: workoutKeys.sessions(studentId ?? 'none'),
    enabled: Boolean(studentId),
    queryFn: ({ pageParam }) =>
      fetchStudentSessions(studentId!, { cursor: pageParam as string | undefined, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
