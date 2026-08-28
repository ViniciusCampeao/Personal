import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TENANT_PRISMA, type TenantPrismaClient } from '../prisma/tenant-prisma.provider';

/**
 * Spec §4's "Guard dedicado (`OwnsStudentGuard`)" — a `STUDENT` only ever accesses their
 * own data, a `TRAINER` only accesses students where `studentProfile.trainerId` is them.
 * This exact check was duplicated across `programs` and `sessions` (M3/M4); `progress`
 * (M5) is the third consumer, so it's worth sharing from here on.
 */
@Injectable()
export class StudentAccessService {
  constructor(@Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient) {}

  async assertCanAccessStudent(
    studentId: string,
    callerUserId: string,
    callerRole: Role,
  ): Promise<void> {
    if (callerRole === Role.STUDENT) {
      if (studentId !== callerUserId) throw new NotFoundException('Aluno não encontrado.');
      return;
    }

    const student = await this.db.studentProfile.findUnique({ where: { userId: studentId } });
    if (!student || student.trainerId !== callerUserId) {
      throw new NotFoundException('Aluno não encontrado.');
    }
  }
}
