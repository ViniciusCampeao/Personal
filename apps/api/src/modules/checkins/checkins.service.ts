import { Inject, Injectable } from '@nestjs/common';
import { type Role } from '@prisma/client';
import {
  type CheckInDto,
  type ListCheckInsQuery,
  type ListCheckInsResponseDto,
  type SubmitCheckInInput,
} from '@pt/shared';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { StudentAccessService } from '../../common/students/student-access.service';
import { mondayOfUtc } from '../../common/util/week';

@Injectable()
export class CheckInsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  async current(studentId: string): Promise<CheckInDto | null> {
    const weekStart = new Date(mondayOfUtc(new Date()));
    const row = await this.db.checkIn.findUnique({
      where: { studentId_weekStart: { studentId, weekStart } },
    });
    return row ? this.toDto(row) : null;
  }

  async submit(studentId: string, input: SubmitCheckInInput): Promise<CheckInDto> {
    const tenantId = this.tenantContext.getTenantId();
    const weekStart = new Date(mondayOfUtc(new Date()));
    const row = await this.db.checkIn.upsert({
      where: { studentId_weekStart: { studentId, weekStart } },
      create: { tenantId, studentId, weekStart, ...input },
      update: { ...input },
    });
    return this.toDto(row);
  }

  async listForStudent(
    studentId: string,
    callerUserId: string,
    callerRole: Role,
    query: ListCheckInsQuery,
  ): Promise<ListCheckInsResponseDto> {
    await this.studentAccess.assertCanAccessStudent(studentId, callerUserId, callerRole);

    const rows = await this.db.checkIn.findMany({
      where: { studentId },
      orderBy: [{ weekStart: 'desc' }, { id: 'asc' }],
      take: query.limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
    });

    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    return {
      items: items.map((row) => this.toDto(row)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  private toDto(row: {
    id: string;
    weekStart: Date;
    sleepQuality: number | null;
    energy: number | null;
    soreness: number | null;
    stress: number | null;
    weightKg: number | null;
    notes: string | null;
    createdAt: Date;
  }): CheckInDto {
    return {
      id: row.id,
      weekStart: row.weekStart.toISOString().slice(0, 10),
      sleepQuality: row.sleepQuality,
      energy: row.energy,
      soreness: row.soreness,
      stress: row.stress,
      weightKg: row.weightKg,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
