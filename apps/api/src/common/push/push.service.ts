import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { type Env } from '../../config/env';
import { TENANT_PRISMA, type TenantPrismaClient } from '../prisma/tenant-prisma.provider';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Thin wrapper around `web-push`. Delivery is best-effort — a failed send never
 * propagates to the caller (a notification is still recorded even if no device could be
 * reached); only an expired/revoked subscription (404/410) is cleaned up.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    config: ConfigService<Env, true>,
  ) {
    webpush.setVapidDetails(
      config.get('VAPID_SUBJECT', { infer: true }),
      config.get('VAPID_PUBLIC_KEY', { infer: true }),
      config.get('VAPID_PRIVATE_KEY', { infer: true }),
    );
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    const subscriptions = await this.db.pushSubscription.findMany({ where: { userId } });
    await Promise.all(subscriptions.map((sub) => this.sendOne(sub, payload)));
  }

  private async sendOne(
    sub: { id: string; endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await this.db.pushSubscription.deleteMany({ where: { id: sub.id } });
      } else {
        this.logger.warn(`Falha ao enviar push (subscription ${sub.id}): ${String(err)}`);
      }
    }
  }
}
