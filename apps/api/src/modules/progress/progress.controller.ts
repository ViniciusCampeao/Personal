import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  adherenceQuerySchema,
  progressVolumeQuerySchema,
  type AdherenceQuery,
  type AdherenceWeekDto,
  type ExerciseProgressPointDto,
  type PersonalRecordDto,
  type ProgressionSuggestionDto,
  type ProgressVolumeQuery,
  type VolumeByMuscleDto,
} from '@pt/shared';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { type RequestUser } from '../../common/auth/types';
import { ProgressService } from './progress.service';

@Controller('students/:id')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('progress/exercises/:exerciseId')
  exerciseSeries(
    @Param('id') studentId: string,
    @Param('exerciseId') exerciseId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<ExerciseProgressPointDto[]> {
    return this.progress.exerciseSeries(studentId, exerciseId, user.id, user.role);
  }

  @Get('progress/volume')
  volumeByMuscle(
    @Param('id') studentId: string,
    @Query(new ZodValidationPipe(progressVolumeQuerySchema)) query: ProgressVolumeQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<VolumeByMuscleDto[]> {
    return this.progress.volumeByMuscle(studentId, query, user.id, user.role);
  }

  @Get('progress/adherence')
  adherence(
    @Param('id') studentId: string,
    @Query(new ZodValidationPipe(adherenceQuerySchema)) query: AdherenceQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<AdherenceWeekDto[]> {
    return this.progress.adherence(studentId, query, user.id, user.role);
  }

  @Get('records')
  records(
    @Param('id') studentId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<PersonalRecordDto[]> {
    return this.progress.records(studentId, user.id, user.role);
  }

  @Get('progression-suggestions')
  progressionSuggestions(
    @Param('id') studentId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<ProgressionSuggestionDto[]> {
    return this.progress.progressionSuggestions(studentId, user.id, user.role);
  }
}
