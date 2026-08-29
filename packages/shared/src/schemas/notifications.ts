import { z } from 'zod';

/** `Notification.type` is a free `String` in Prisma — this is the closed set M8 emits. */
export const notificationTypes = [
  'WORKOUT_TODAY',
  'CHECKIN_REMINDER',
  'PR_ACHIEVED',
  'TRAINER_COMMENT',
] as const;
export type NotificationType = (typeof notificationTypes)[number];

export const listNotificationsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.coerce.boolean().default(false),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface ListNotificationsResponseDto {
  items: NotificationDto[];
  nextCursor: string | null;
}

/** Mirrors the browser's `PushSubscription.toJSON()` shape, not the Prisma table. */
export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(500).optional(),
});
export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;
