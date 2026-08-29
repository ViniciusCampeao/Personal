import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  createSessionCommentSchema,
  finishSessionSchema,
  listSessionsQuerySchema,
  logSetSchema,
  startSessionSchema,
  substituteExerciseSchema,
  syncSessionsSchema,
  type CreateSessionCommentInput,
  type FinishSessionInput,
  type ListSessionsQuery,
  type ListSessionsResponseDto,
  type LogSetInput,
  type SessionDto,
  type SessionExerciseDto,
  type SetLogDto,
  type StartSessionInput,
  type SubstituteExerciseInput,
  type SyncSessionsInput,
  type SyncSessionsResponseDto,
  type TodayResponseDto,
} from '@pt/shared';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { type RequestUser } from '../../common/auth/types';
import { SessionsService } from './sessions.service';

@Controller()
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Roles(Role.STUDENT)
  @Get('me/today')
  today(@CurrentUser() user: RequestUser): Promise<TodayResponseDto> {
    return this.sessions.today(user.id);
  }

  @Roles(Role.STUDENT)
  @Post('sessions')
  start(
    @Body(new ZodValidationPipe(startSessionSchema)) body: StartSessionInput,
    @CurrentUser() user: RequestUser,
  ): Promise<SessionDto> {
    return this.sessions.start(user.id, body);
  }

  @Get('sessions/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<SessionDto> {
    return this.sessions.findOne(id, user.id, user.role);
  }

  @Roles(Role.STUDENT)
  @Post('sessions/:id/sets')
  logSet(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(logSetSchema)) body: LogSetInput,
    @CurrentUser() user: RequestUser,
  ): Promise<SetLogDto> {
    return this.sessions.logSet(id, user.id, body);
  }

  @Patch('sessions/:id/exercises/:seId/substitute')
  substitute(
    @Param('id') id: string,
    @Param('seId') seId: string,
    @Body(new ZodValidationPipe(substituteExerciseSchema)) body: SubstituteExerciseInput,
    @CurrentUser() user: RequestUser,
  ): Promise<SessionExerciseDto> {
    return this.sessions.substitute(id, seId, user.id, user.role, body);
  }

  @Roles(Role.STUDENT)
  @Post('sessions/:id/finish')
  finish(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(finishSessionSchema)) body: FinishSessionInput,
    @CurrentUser() user: RequestUser,
  ): Promise<SessionDto> {
    return this.sessions.finish(id, user.id, body);
  }

  @Get('students/:id/sessions')
  listForStudent(
    @Param('id') studentId: string,
    @Query(new ZodValidationPipe(listSessionsQuerySchema)) query: ListSessionsQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<ListSessionsResponseDto> {
    return this.sessions.listForStudent(studentId, user.id, user.role, query);
  }

  @Post('sessions/:id/comments')
  addComment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createSessionCommentSchema)) body: CreateSessionCommentInput,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.sessions.addComment(id, user.id, user.role, body);
  }

  @Roles(Role.STUDENT)
  @Post('sessions/sync')
  sync(
    @Body(new ZodValidationPipe(syncSessionsSchema)) body: SyncSessionsInput,
    @CurrentUser() user: RequestUser,
  ): Promise<SyncSessionsResponseDto> {
    return this.sessions.sync(user.id, body);
  }
}
