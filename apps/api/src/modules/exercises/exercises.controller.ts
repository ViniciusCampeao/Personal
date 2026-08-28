import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  createExerciseSchema,
  listExercisesQuerySchema,
  updateExerciseSchema,
  type CreateExerciseInput,
  type ExerciseDto,
  type ListExercisesQuery,
  type ListExercisesResponseDto,
  type UpdateExerciseInput,
} from '@pt/shared';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { type RequestUser } from '../../common/auth/types';
import { ExercisesService } from './exercises.service';

@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listExercisesQuerySchema)) query: ListExercisesQuery,
  ): Promise<ListExercisesResponseDto> {
    return this.exercises.list(query);
  }

  @Roles(Role.TRAINER)
  @Post()
  create(
    @Body(new ZodValidationPipe(createExerciseSchema)) body: CreateExerciseInput,
    @CurrentUser() user: RequestUser,
  ): Promise<ExerciseDto> {
    return this.exercises.create(user.id, body);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ExerciseDto> {
    return this.exercises.findOne(id);
  }

  @Roles(Role.TRAINER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateExerciseSchema)) body: UpdateExerciseInput,
  ): Promise<ExerciseDto> {
    return this.exercises.update(id, body);
  }

  @Get(':id/substitutes')
  substitutes(@Param('id') id: string): Promise<ExerciseDto[]> {
    return this.exercises.substitutes(id);
  }
}
