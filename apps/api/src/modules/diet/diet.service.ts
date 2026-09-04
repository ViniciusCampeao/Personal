import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  type CreateDietCommentInput,
  type DietCommentDto,
  type DietPlanDto,
  type UpsertDietPlanInput,
} from '@pt/shared';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { StudentAccessService } from '../../common/students/student-access.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DietService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly studentAccess: StudentAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Trainer view: every plan ever made for the student, newest first. */
  async listForStudent(studentId: string, trainerId: string): Promise<DietPlanDto[]> {
    await this.studentAccess.assertCanAccessStudent(studentId, trainerId, Role.TRAINER);
    const rows = await this.db.dietPlan.findMany({
      where: { studentId },
      include: { meals: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  /** Student view: the single active plan, or null. */
  async activeForStudent(studentId: string): Promise<DietPlanDto | null> {
    const row = await this.db.dietPlan.findFirst({
      where: { studentId, active: true },
      include: { meals: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.toDto(row) : null;
  }

  async create(
    studentId: string,
    trainerId: string,
    input: UpsertDietPlanInput,
  ): Promise<DietPlanDto> {
    await this.studentAccess.assertCanAccessStudent(studentId, trainerId, Role.TRAINER);
    const tenantId = this.tenantContext.getTenantId();

    // Only one active plan per student: creating a new one retires the previous.
    await this.db.dietPlan.updateMany({
      where: { studentId, active: true },
      data: { active: false },
    });

    const row = await this.db.dietPlan.create({
      data: {
        tenantId,
        studentId,
        trainerId,
        title: input.title,
        goal: input.goal,
        notes: input.notes,
        meals: {
          create: input.meals.map((meal, position) => ({
            name: meal.name,
            time: meal.time,
            items: meal.items,
            position,
          })),
        },
      },
      include: { meals: { orderBy: { position: 'asc' } } },
    });
    await this.notifications.notify(studentId, {
      type: 'DIET_COMMENT',
      title: 'Nova dieta disponível',
      body: input.title,
      data: { dietId: row.id },
    });
    return this.toDto(row);
  }

  async update(
    dietId: string,
    trainerId: string,
    input: UpsertDietPlanInput,
  ): Promise<DietPlanDto> {
    await this.ownedPlan(dietId, trainerId, Role.TRAINER);

    await this.db.dietMeal.deleteMany({ where: { dietId } });
    const row = await this.db.dietPlan.update({
      where: { id: dietId },
      data: {
        title: input.title,
        goal: input.goal,
        notes: input.notes,
        meals: {
          create: input.meals.map((meal, position) => ({
            name: meal.name,
            time: meal.time,
            items: meal.items,
            position,
          })),
        },
      },
      include: { meals: { orderBy: { position: 'asc' } } },
    });
    return this.toDto(row);
  }

  async deactivate(dietId: string, trainerId: string): Promise<void> {
    await this.ownedPlan(dietId, trainerId, Role.TRAINER);
    await this.db.dietPlan.update({ where: { id: dietId }, data: { active: false } });
  }

  async addComment(
    dietId: string,
    userId: string,
    role: Role,
    input: CreateDietCommentInput,
  ): Promise<void> {
    const plan = await this.ownedPlan(dietId, userId, role);
    const tenantId = this.tenantContext.getTenantId();
    await this.db.dietComment.create({
      data: { tenantId, dietId, authorId: userId, body: input.body },
    });

    if (userId === plan.studentId) {
      await this.notifications.notify(plan.trainerId, {
        type: 'DIET_COMMENT',
        title: 'Comentário do aluno na dieta',
        body: input.body.slice(0, 200),
        data: { dietId },
      });
    } else {
      await this.notifications.notify(plan.studentId, {
        type: 'DIET_COMMENT',
        title: 'Novo comentário do trainer na dieta',
        body: input.body.slice(0, 200),
        data: { dietId },
      });
    }
  }

  async listComments(dietId: string, userId: string, role: Role): Promise<DietCommentDto[]> {
    await this.ownedPlan(dietId, userId, role);
    const rows = await this.db.dietComment.findMany({
      where: { dietId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { name: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      authorId: row.authorId,
      authorName: row.author.name,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    }));
  }

  /** 404 (never 403) on mismatch — same reasoning as `programs.service.ts`: don't reveal
   * whether the resource exists to a caller who has no business with it. */
  private async ownedPlan(dietId: string, userId: string, role: Role) {
    const plan = await this.db.dietPlan.findUnique({ where: { id: dietId } });
    if (!plan) throw new NotFoundException('Dieta não encontrada.');
    await this.studentAccess.assertCanAccessStudent(plan.studentId, userId, role);
    return plan;
  }

  private toDto(row: {
    id: string;
    studentId: string;
    trainerId: string;
    title: string;
    goal: string | null;
    notes: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    meals: { id: string; name: string; time: string | null; items: string[] }[];
  }): DietPlanDto {
    return {
      id: row.id,
      studentId: row.studentId,
      trainerId: row.trainerId,
      title: row.title,
      goal: row.goal,
      notes: row.notes,
      active: row.active,
      meals: row.meals.map((meal) => ({
        id: meal.id,
        name: meal.name,
        time: meal.time,
        items: meal.items,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
