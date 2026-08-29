import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  listNotificationsQuerySchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  type ListNotificationsQuery,
  type ListNotificationsResponseDto,
  type PushSubscribeInput,
  type PushUnsubscribeInput,
} from '@pt/shared';
import { type Env } from '../../config/env';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { type RequestUser } from '../../common/auth/types';
import { NotificationsService } from './notifications.service';

@Controller()
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Public VAPID key the browser needs to call `pushManager.subscribe()` — without
   * this, `POST /push/subscribe` has nothing to build a subscription against. */
  @Get('push/vapid-public-key')
  vapidPublicKey(): { publicKey: string } {
    return { publicKey: this.config.get('VAPID_PUBLIC_KEY', { infer: true }) };
  }

  @Get('notifications')
  list(
    @Query(new ZodValidationPipe(listNotificationsQuerySchema)) query: ListNotificationsQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<ListNotificationsResponseDto> {
    return this.notifications.list(user.id, query);
  }

  @Post('notifications/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.notifications.markRead(id, user.id);
  }

  @Post('push/subscribe')
  subscribe(
    @Body(new ZodValidationPipe(pushSubscribeSchema)) body: PushSubscribeInput,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.notifications.subscribe(user.id, body);
  }

  @Delete('push/subscribe')
  unsubscribe(
    @Body(new ZodValidationPipe(pushUnsubscribeSchema)) body: PushUnsubscribeInput,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.notifications.unsubscribe(user.id, body);
  }
}
