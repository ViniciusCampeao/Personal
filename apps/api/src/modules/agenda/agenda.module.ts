import { Module } from '@nestjs/common';
import { StudentAccessModule } from '../../common/students/student-access.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';

@Module({
  imports: [StudentAccessModule, NotificationsModule],
  controllers: [AgendaController],
  providers: [AgendaService],
})
export class AgendaModule {}
