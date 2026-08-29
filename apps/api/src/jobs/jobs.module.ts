import { Module } from '@nestjs/common';
import { SessionsModule } from '../modules/sessions/sessions.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [SessionsModule, NotificationsModule],
  providers: [JobsService],
})
export class JobsModule {}
