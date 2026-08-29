import { Module } from '@nestjs/common';
import { StudentAccessModule } from '../../common/students/student-access.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [StudentAccessModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
