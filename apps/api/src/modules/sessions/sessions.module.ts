import { Module } from '@nestjs/common';
import { ExercisesModule } from '../exercises/exercises.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [ExercisesModule, NotificationsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
