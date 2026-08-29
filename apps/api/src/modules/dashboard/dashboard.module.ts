import { Module } from '@nestjs/common';
import { ProgressModule } from '../progress/progress.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ProgressModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
