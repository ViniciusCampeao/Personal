import { Module } from '@nestjs/common';
import { StudentAccessModule } from '../../common/students/student-access.module';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [StudentAccessModule],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
