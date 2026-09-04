import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  type AgendaEventDto,
  type ListAgendaEventsQuery,
  type UpdateAgendaEventStatusInput,
  type UpsertAgendaEventInput,
} from '@pt/shared';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { StudentAccessService } from '../../common/students/student-access.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AgendaService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly studentAccess: StudentAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async listForTrainer(trainerId: string, query: ListAgendaEventsQuery): Promise<AgendaEventDto[]> {
    const rows = await this.db.agendaEvent.findMany({
      where: {
        trainerId,
        startsAt: { gte: query.from, lte: query.to },
        ...(query.studentId ? { studentId: query.studentId } : {}),
      },
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async listForStudent(studentId: string, query: ListAgendaEventsQuery): Promise<AgendaEventDto[]> {
    const rows = await this.db.agendaEvent.findMany({
      where: { studentId, startsAt: { gte: query.from, lte: query.to } },
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async create(trainerId: string, input: UpsertAgendaEventInput): Promise<AgendaEventDto> {
    if (input.studentId) {
      await this.studentAccess.assertCanAccessStudent(input.studentId, trainerId, Role.TRAINER);
    }
    const tenantId = this.tenantContext.getTenantId();
    const row = await this.db.agendaEvent.create({
      data: {
        tenantId,
        trainerId,
        studentId: input.studentId,
        type: input.type,
        title: input.title,
        notes: input.notes,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
      include: { student: { include: { user: { select: { name: true } } } } },
    });
    if (input.studentId) {
      await this.notifications.notify(input.studentId, {
        type: 'AGENDA_EVENT',
        title: 'Novo compromisso na agenda',
        body: input.title,
        data: { agendaEventId: row.id },
      });
    }
    return this.toDto(row);
  }

  async update(
    eventId: string,
    trainerId: string,
    input: UpsertAgendaEventInput,
  ): Promise<AgendaEventDto> {
    await this.owned(eventId, trainerId);
    if (input.studentId) {
      await this.studentAccess.assertCanAccessStudent(input.studentId, trainerId, Role.TRAINER);
    }
    const row = await this.db.agendaEvent.update({
      where: { id: eventId },
      data: {
        studentId: input.studentId ?? null,
        type: input.type,
        title: input.title,
        notes: input.notes,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
      include: { student: { include: { user: { select: { name: true } } } } },
    });
    return this.toDto(row);
  }

  async updateStatus(
    eventId: string,
    trainerId: string,
    input: UpdateAgendaEventStatusInput,
  ): Promise<AgendaEventDto> {
    await this.owned(eventId, trainerId);
    const row = await this.db.agendaEvent.update({
      where: { id: eventId },
      data: { status: input.status },
      include: { student: { include: { user: { select: { name: true } } } } },
    });
    return this.toDto(row);
  }

  async remove(eventId: string, trainerId: string): Promise<void> {
    await this.owned(eventId, trainerId);
    await this.db.agendaEvent.delete({ where: { id: eventId } });
  }

  private async owned(eventId: string, trainerId: string) {
    const event = await this.db.agendaEvent.findUnique({ where: { id: eventId } });
    if (!event || event.trainerId !== trainerId) {
      throw new NotFoundException('Compromisso não encontrado.');
    }
    return event;
  }

  private toDto(row: {
    id: string;
    studentId: string | null;
    type: AgendaEventDto['type'];
    status: AgendaEventDto['status'];
    title: string;
    notes: string | null;
    startsAt: Date;
    endsAt: Date;
    student: { user: { name: string } } | null;
  }): AgendaEventDto {
    return {
      id: row.id,
      studentId: row.studentId,
      studentName: row.student?.user.name ?? null,
      type: row.type,
      status: row.status,
      title: row.title,
      notes: row.notes,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
    };
  }
}
