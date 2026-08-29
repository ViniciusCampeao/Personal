import { Inject, Injectable } from '@nestjs/common';
import {
  type ListNotificationsQuery,
  type ListNotificationsResponseDto,
  type NotificationDto,
  type NotificationType,
  type PushSubscribeInput,
  type PushUnsubscribeInput,
} from '@pt/shared';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PushService } from '../../common/push/push.service';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly push: PushService,
  ) {}

  /** Core method reused by `SessionsService` (PR, comments) and `JobsService` (crons). */
  async notify(userId: string, input: NotifyInput): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    await this.db.notification.create({
      data: {
        tenantId,
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data,
        sentAt: new Date(),
      },
    });
    await this.push.sendToUser(userId, { title: input.title, body: input.body, data: input.data });
  }

  async list(userId: string, query: ListNotificationsQuery): Promise<ListNotificationsResponseDto> {
    const rows = await this.db.notification.findMany({
      where: { userId, ...(query.unreadOnly ? { readAt: null } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: query.limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
    });

    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    return {
      items: items.map((row) => this.toDto(row)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.db.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async subscribe(userId: string, input: PushSubscribeInput): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    await this.db.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        tenantId,
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent,
      },
      update: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent,
      },
    });
  }

  async unsubscribe(userId: string, input: PushUnsubscribeInput): Promise<void> {
    await this.db.pushSubscription.deleteMany({ where: { endpoint: input.endpoint, userId } });
  }

  private toDto(row: {
    id: string;
    type: string;
    title: string;
    body: string;
    data: unknown;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationDto {
    return {
      id: row.id,
      type: row.type as NotificationType,
      title: row.title,
      body: row.body,
      data: (row.data as Record<string, unknown> | null) ?? null,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
