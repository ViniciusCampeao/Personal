import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  listAgendaEventsQuerySchema,
  updateAgendaEventStatusSchema,
  upsertAgendaEventSchema,
  type AgendaEventDto,
  type ListAgendaEventsQuery,
  type UpdateAgendaEventStatusInput,
  type UpsertAgendaEventInput,
} from '@pt/shared';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { type RequestUser } from '../../common/auth/types';
import { AgendaService } from './agenda.service';

@Controller('agenda-events')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listAgendaEventsQuerySchema)) query: ListAgendaEventsQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<AgendaEventDto[]> {
    return user.role === Role.STUDENT
      ? this.agenda.listForStudent(user.id, query)
      : this.agenda.listForTrainer(user.id, query);
  }

  @Roles(Role.TRAINER)
  @Post()
  create(
    @Body(new ZodValidationPipe(upsertAgendaEventSchema)) body: UpsertAgendaEventInput,
    @CurrentUser() user: RequestUser,
  ): Promise<AgendaEventDto> {
    return this.agenda.create(user.id, body);
  }

  @Roles(Role.TRAINER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(upsertAgendaEventSchema)) body: UpsertAgendaEventInput,
    @CurrentUser() user: RequestUser,
  ): Promise<AgendaEventDto> {
    return this.agenda.update(id, user.id, body);
  }

  @Roles(Role.TRAINER)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAgendaEventStatusSchema)) body: UpdateAgendaEventStatusInput,
    @CurrentUser() user: RequestUser,
  ): Promise<AgendaEventDto> {
    return this.agenda.updateStatus(id, user.id, body);
  }

  @Roles(Role.TRAINER)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.agenda.remove(id, user.id);
  }
}
