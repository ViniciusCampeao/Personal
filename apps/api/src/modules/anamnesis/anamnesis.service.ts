import { Inject, Injectable } from '@nestjs/common';
import { type Prisma, ConsentType, Role } from '@prisma/client';
import {
  type AnamnesisDto,
  type AnamnesisListResponseDto,
  type CreateAnamnesisInput,
  type CreateMedicalClearanceInput,
  type MedicalClearanceSummaryDto,
} from '@pt/shared';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { ConsentService, type ConsentContext } from '../../common/legal/consent.service';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { StorageService } from '../../common/storage/storage.service';
import { StudentAccessService } from '../../common/students/student-access.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

type AnamnesisRow = Prisma.AnamnesisGetPayload<object>;

@Injectable()
export class AnamnesisService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly studentAccess: StudentAccessService,
    private readonly encryption: FieldEncryptionService,
    private readonly consent: ConsentService,
    private readonly audit: AuditLogService,
    private readonly storage: StorageService,
  ) {}

  async list(
    studentId: string,
    callerUserId: string,
    callerRole: Role,
    ip: string | undefined,
  ): Promise<AnamnesisListResponseDto> {
    await this.studentAccess.assertCanAccessStudent(studentId, callerUserId, callerRole);

    const versions = await this.db.anamnesis.findMany({
      where: { studentId },
      orderBy: { version: 'desc' },
    });
    const clearanceRow = await this.db.medicalClearance.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    // Spec §10.6: only a non-titular (TRAINER) read gets logged.
    if (callerRole === Role.TRAINER) {
      if (versions.length > 0) {
        await this.audit.recordSensitiveRead(callerUserId, 'Anamnesis', versions[0].id, ip);
      }
      if (clearanceRow) {
        await this.audit.recordSensitiveRead(callerUserId, 'MedicalClearance', clearanceRow.id, ip);
      }
    }

    let medicalClearance: MedicalClearanceSummaryDto | null = null;
    if (clearanceRow) {
      medicalClearance = {
        id: clearanceRow.id,
        fileUrl: await this.storage.presignGet(clearanceRow.fileKey),
        issuedAt: clearanceRow.issuedAt?.toISOString() ?? null,
        expiresAt: clearanceRow.expiresAt?.toISOString() ?? null,
        verifiedAt: clearanceRow.verifiedAt?.toISOString() ?? null,
      };
    }

    return { versions: versions.map((row) => this.toDto(row)), medicalClearance };
  }

  async create(
    studentId: string,
    callerUserId: string,
    callerRole: Role,
    input: CreateAnamnesisInput,
    ctx: ConsentContext,
  ): Promise<AnamnesisDto> {
    await this.studentAccess.assertCanAccessStudent(studentId, callerUserId, callerRole);
    // Consent belongs to the data subject (the student) regardless of who submits the
    // form — a trainer filling it in during an interview doesn't consent on the
    // student's behalf.
    await this.consent.requireConsent(
      studentId,
      ConsentType.HEALTH_DATA,
      input.healthDataConsent.accepted,
      ctx,
    );

    const last = await this.db.anamnesis.findFirst({
      where: { studentId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    const created = await this.db.anamnesis.create({
      data: {
        tenantId: this.tenantContext.getTenantId(),
        studentId,
        version: nextVersion,
        parq: this.encryption.encryptJson(input.parq),
        injuries: this.encryption.encryptJson(input.injuries),
        conditions: input.conditions ? this.encryption.encrypt(input.conditions) : null,
        medications: input.medications ? this.encryption.encrypt(input.medications) : null,
        surgeries: input.surgeries ? this.encryption.encrypt(input.surgeries) : null,
        smokes: input.smokes,
        alcohol: input.alcohol,
        sleepHours: input.sleepHours,
        trainingHistory: input.trainingHistory
          ? this.encryption.encrypt(input.trainingHistory)
          : null,
        notes: input.notes ? this.encryption.encrypt(input.notes) : null,
      },
    });

    return this.toDto(created);
  }

  async createMedicalClearance(
    studentId: string,
    callerUserId: string,
    callerRole: Role,
    input: CreateMedicalClearanceInput,
  ): Promise<void> {
    await this.studentAccess.assertCanAccessStudent(studentId, callerUserId, callerRole);

    await this.db.medicalClearance.create({
      data: {
        tenantId: this.tenantContext.getTenantId(),
        studentId,
        fileKey: input.fileKey,
        issuedAt: input.issuedAt,
        expiresAt: input.expiresAt,
      },
    });
  }

  private toDto(row: AnamnesisRow): AnamnesisDto {
    return {
      id: row.id,
      version: row.version,
      parq: this.encryption.decryptJson(row.parq),
      injuries: this.encryption.decryptJson(row.injuries),
      conditions: row.conditions ? this.encryption.decrypt(row.conditions) : null,
      medications: row.medications ? this.encryption.decrypt(row.medications) : null,
      surgeries: row.surgeries ? this.encryption.decrypt(row.surgeries) : null,
      smokes: row.smokes,
      alcohol: row.alcohol,
      sleepHours: row.sleepHours,
      trainingHistory: row.trainingHistory ? this.encryption.decrypt(row.trainingHistory) : null,
      notes: row.notes ? this.encryption.decrypt(row.notes) : null,
      answeredAt: row.answeredAt.toISOString(),
    };
  }
}
