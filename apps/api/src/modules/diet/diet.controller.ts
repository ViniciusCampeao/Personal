import { Body, Controller, Delete, Get, Param, Post, Patch } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  createDietCommentSchema,
  upsertDietPlanSchema,
  type CreateDietCommentInput,
  type DietCommentDto,
  type DietPlanDto,
  type UpsertDietPlanInput,
} from '@pt/shared';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { type RequestUser } from '../../common/auth/types';
import { DietService } from './diet.service';

@Controller()
export class DietController {
  constructor(private readonly diet: DietService) {}

  @Roles(Role.STUDENT)
  @Get('me/diet-plan')
  myActivePlan(@CurrentUser() user: RequestUser): Promise<DietPlanDto | null> {
    return this.diet.activeForStudent(user.id);
  }

  @Roles(Role.TRAINER)
  @Get('students/:id/diet-plans')
  listForStudent(
    @Param('id') studentId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<DietPlanDto[]> {
    return this.diet.listForStudent(studentId, user.id);
  }

  @Roles(Role.TRAINER)
  @Post('students/:id/diet-plans')
  create(
    @Param('id') studentId: string,
    @Body(new ZodValidationPipe(upsertDietPlanSchema)) body: UpsertDietPlanInput,
    @CurrentUser() user: RequestUser,
  ): Promise<DietPlanDto> {
    return this.diet.create(studentId, user.id, body);
  }

  @Roles(Role.TRAINER)
  @Patch('diet-plans/:id')
  update(
    @Param('id') dietId: string,
    @Body(new ZodValidationPipe(upsertDietPlanSchema)) body: UpsertDietPlanInput,
    @CurrentUser() user: RequestUser,
  ): Promise<DietPlanDto> {
    return this.diet.update(dietId, user.id, body);
  }

  @Roles(Role.TRAINER)
  @Delete('diet-plans/:id')
  deactivate(@Param('id') dietId: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.diet.deactivate(dietId, user.id);
  }

  @Get('diet-plans/:id/comments')
  listComments(
    @Param('id') dietId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<DietCommentDto[]> {
    return this.diet.listComments(dietId, user.id, user.role);
  }

  @Post('diet-plans/:id/comments')
  addComment(
    @Param('id') dietId: string,
    @Body(new ZodValidationPipe(createDietCommentSchema)) body: CreateDietCommentInput,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.diet.addComment(dietId, user.id, user.role, body);
  }
}
