import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  listCheckInsQuerySchema,
  submitCheckInSchema,
  type CheckInDto,
  type ListCheckInsQuery,
  type ListCheckInsResponseDto,
  type SubmitCheckInInput,
} from '@pt/shared';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { type RequestUser } from '../../common/auth/types';
import { CheckInsService } from './checkins.service';

@Controller()
export class CheckInsController {
  constructor(private readonly checkIns: CheckInsService) {}

  @Roles(Role.STUDENT)
  @Get('me/check-in/current')
  current(@CurrentUser() user: RequestUser): Promise<CheckInDto | null> {
    return this.checkIns.current(user.id);
  }

  @Roles(Role.STUDENT)
  @Post('me/check-in')
  submit(
    @Body(new ZodValidationPipe(submitCheckInSchema)) body: SubmitCheckInInput,
    @CurrentUser() user: RequestUser,
  ): Promise<CheckInDto> {
    return this.checkIns.submit(user.id, body);
  }

  @Get('students/:id/check-ins')
  listForStudent(
    @Param('id') studentId: string,
    @Query(new ZodValidationPipe(listCheckInsQuerySchema)) query: ListCheckInsQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<ListCheckInsResponseDto> {
    return this.checkIns.listForStudent(studentId, user.id, user.role, query);
  }
}
