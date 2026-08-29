import type { ListNotificationsResponseDto } from '@pt/shared';
import { apiFetch } from '@/lib/api';

export function fetchNotifications(
  params: { cursor?: string; limit?: number; unreadOnly?: boolean } = {},
): Promise<ListNotificationsResponseDto> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.unreadOnly) query.set('unreadOnly', 'true');
  const search = query.toString();
  const suffix = search ? `?${search}` : '';
  return apiFetch<ListNotificationsResponseDto>(`/notifications${suffix}`);
}

export function markNotificationRead(id: string): Promise<void> {
  return apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' });
}
