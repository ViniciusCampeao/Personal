import { useQuery } from '@tanstack/react-query';
import { fetchNotifications } from './notifications-api';

export const notificationKeys = {
  list: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
};

/** Drives the header badge; kept small and cheap since it polls on focus. */
export function useUnreadNotifications() {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => fetchNotifications({ unreadOnly: true, limit: 20 }),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
