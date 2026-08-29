import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Role } from '@prisma/client';
import { TENANT_PRISMA, type TenantPrismaClient } from '../common/prisma/tenant-prisma.provider';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { mondayOfUtc, startOfUtcDay } from '../common/util/week';
import { SessionsService } from '../modules/sessions/sessions.service';
import { NotificationsService } from '../modules/notifications/notifications.service';

/**
 * Recurring reminders (spec M8). Each cron lists students cross-tenant via
 * `runUnscoped()`, then re-enters a per-student tenant context via `run()` so
 * `NotificationsService`/`TENANT_PRISMA` keep their automatic tenant filter. One
 * student failing never aborts the rest of the batch — same spirit as the offline
 * sync replay in `SessionsService.sync()`.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly sessions: SessionsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 7 * * *', { timeZone: 'America/Sao_Paulo' })
  async notifyWorkoutToday(): Promise<void> {
    const students = await this.tenantContext.runUnscoped(() =>
      this.db.studentProfile.findMany({
        where: { programs: { some: { status: 'ACTIVE' } } },
        select: { userId: true, tenantId: true },
      }),
    );

    const startOfDay = startOfUtcDay(new Date());
    for (const student of students) {
      try {
        await this.tenantContext.run(
          { tenantId: student.tenantId, userId: student.userId, role: Role.STUDENT },
          async () => {
            const alreadyToday = await this.db.workoutSession.findFirst({
              where: { studentId: student.userId, startedAt: { gte: startOfDay } },
            });
            if (alreadyToday) return;

            const today = await this.sessions.today(student.userId);
            if (!today.hasActiveProgram || today.exercises.length === 0) return;

            await this.notifications.notify(student.userId, {
              type: 'WORKOUT_TODAY',
              title: 'Treino de hoje',
              body: `Hoje é dia de treino ${today.dayLabel}.`,
              data: { programId: today.programId, workoutDayId: today.workoutDayId },
            });
          },
        );
      } catch (err) {
        this.logger.error(`Falha ao notificar treino do dia (${student.userId}): ${String(err)}`);
      }
    }
  }

  @Cron('0 8 * * 1', { timeZone: 'America/Sao_Paulo' })
  async notifyCheckInReminder(): Promise<void> {
    const students = await this.tenantContext.runUnscoped(() =>
      this.db.studentProfile.findMany({ select: { userId: true, tenantId: true } }),
    );

    const weekStart = new Date(mondayOfUtc(new Date()));
    for (const student of students) {
      try {
        await this.tenantContext.run(
          { tenantId: student.tenantId, userId: student.userId, role: Role.STUDENT },
          async () => {
            const existing = await this.db.checkIn.findUnique({
              where: { studentId_weekStart: { studentId: student.userId, weekStart } },
            });
            if (existing) return;

            await this.notifications.notify(student.userId, {
              type: 'CHECKIN_REMINDER',
              title: 'Check-in semanal',
              body: 'Não esqueça de preencher seu check-in desta semana.',
            });
          },
        );
      } catch (err) {
        this.logger.error(`Falha ao notificar check-in (${student.userId}): ${String(err)}`);
      }
    }
  }
}
