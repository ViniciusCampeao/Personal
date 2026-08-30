import { Module } from '@nestjs/common';
import { StudentAccessModule } from '../../common/students/student-access.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DietController } from './diet.controller';
import { DietService } from './diet.service';

@Module({
  imports: [StudentAccessModule, NotificationsModule],
  controllers: [DietController],
  providers: [DietService],
})
export class DietModule {}
