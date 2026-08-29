import { Module } from '@nestjs/common';
import { StudentAccessModule } from '../../common/students/student-access.module';
import { CheckInsController } from './checkins.controller';
import { CheckInsService } from './checkins.service';

@Module({
  imports: [StudentAccessModule],
  controllers: [CheckInsController],
  providers: [CheckInsService],
})
export class CheckInsModule {}
