import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  listStudentsQuerySchema,
  updateStudentSchema,
  type ListStudentsQuery,
  type ListStudentsResponseDto,
  type StudentDetailDto,
  type UpdateStudentInput,
} from '@pt/shared';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { type RequestUser } from '../../common/auth/types';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Roles(Role.TRAINER)
  @Get()
  list(
    @Query(new ZodValidationPipe(listStudentsQuerySchema)) query: ListStudentsQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<ListStudentsResponseDto> {
    return this.students.list(user.id, query);
  }

  /** A student may read their own row; anyone else's is a 404, not a 403. */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<StudentDetailDto> {
    return this.students.findOne(id, user.id, user.role);
  }

  @Roles(Role.TRAINER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStudentSchema)) body: UpdateStudentInput,
    @CurrentUser() user: RequestUser,
  ): Promise<StudentDetailDto> {
    return this.students.update(id, user.id, body);
  }
}
