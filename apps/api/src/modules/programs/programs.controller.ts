import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  createDaySchema,
  createProgramSchema,
  duplicateProgramSchema,
  listProgramsQuerySchema,
  replaceDayExercisesSchema,
  updateDaySchema,
  updateProgramSchema,
  type CreateDayInput,
  type CreateProgramInput,
  type DuplicateProgramInput,
  type ListProgramsQuery,
  type ListProgramsResponseDto,
  type ProgramDto,
  type ReplaceDayExercisesInput,
  type UpdateDayInput,
  type UpdateProgramInput,
  type WorkoutDayDto,
} from '@pt/shared';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { type RequestUser } from '../../common/auth/types';
import { ProgramsService } from './programs.service';

/** All routes require TRAINER — a student's own program is served by M4's `/me/today`. */
@Roles(Role.TRAINER)
@Controller()
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get('programs')
  list(
    @Query(new ZodValidationPipe(listProgramsQuerySchema)) query: ListProgramsQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<ListProgramsResponseDto> {
    return this.programs.list(user.id, query);
  }

  @Post('programs')
  create(
    @Body(new ZodValidationPipe(createProgramSchema)) body: CreateProgramInput,
    @CurrentUser() user: RequestUser,
  ): Promise<ProgramDto> {
    return this.programs.create(user.id, body);
  }

  @Get('programs/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<ProgramDto> {
    return this.programs.findOne(id, user.id);
  }

  @Patch('programs/:id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProgramSchema)) body: UpdateProgramInput,
    @CurrentUser() user: RequestUser,
  ): Promise<ProgramDto> {
    return this.programs.update(id, user.id, body);
  }

  @Delete('programs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.programs.remove(id, user.id);
  }

  @Post('programs/:id/duplicate')
  duplicate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(duplicateProgramSchema)) body: DuplicateProgramInput,
    @CurrentUser() user: RequestUser,
  ): Promise<ProgramDto> {
    return this.programs.duplicate(id, user.id, body);
  }

  @Post('programs/:id/activate')
  @HttpCode(HttpStatus.OK)
  activate(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<ProgramDto> {
    return this.programs.activate(id, user.id);
  }

  @Post('programs/:id/days')
  createDay(
    @Param('id') programId: string,
    @Body(new ZodValidationPipe(createDaySchema)) body: CreateDayInput,
    @CurrentUser() user: RequestUser,
  ): Promise<WorkoutDayDto> {
    return this.programs.createDay(programId, user.id, body);
  }

  @Patch('days/:id')
  updateDay(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDaySchema)) body: UpdateDayInput,
    @CurrentUser() user: RequestUser,
  ): Promise<WorkoutDayDto> {
    return this.programs.updateDay(id, user.id, body);
  }

  @Delete('days/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDay(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.programs.removeDay(id, user.id);
  }

  @Put('days/:id/exercises')
  replaceDayExercises(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(replaceDayExercisesSchema)) body: ReplaceDayExercisesInput,
    @CurrentUser() user: RequestUser,
  ): Promise<WorkoutDayDto> {
    return this.programs.replaceDayExercises(id, user.id, body);
  }
}
