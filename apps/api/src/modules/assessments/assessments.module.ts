import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { ConsentModule } from '../../common/legal/consent.module';
import { StudentAccessModule } from '../../common/students/student-access.module';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';

@Module({
  imports: [StudentAccessModule, ConsentModule, AuditModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsService],
})
export class AssessmentsModule {}
