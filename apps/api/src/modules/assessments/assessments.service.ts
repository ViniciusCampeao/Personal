import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Prisma, ConsentType, Role } from '@prisma/client';
import { CalcValidationError, calculateBodyComposition, type SkinfoldSite } from '@pt/shared';
import {
  type AddAssessmentPhotoInput,
  type AssessmentCompareDiffDto,
  type AssessmentCompareDto,
  type AssessmentDetailDto,
  type AssessmentPhotoDto,
  type AssessmentSummaryDto,
  type CompareAssessmentsQuery,
  type CreateAssessmentInput,
  type ListAssessmentsQuery,
  type ListAssessmentsResponseDto,
} from '@pt/shared';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { ConsentService, type ConsentContext } from '../../common/legal/consent.service';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { StorageService } from '../../common/storage/storage.service';
import { StudentAccessService } from '../../common/students/student-access.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { buildAssessmentPdf } from './assessment-pdf.builder';

const assessmentDetailInclude = {
  measurements: true,
  skinfolds: true,
  photos: { orderBy: { takenAt: 'asc' as const } },
};

type AssessmentWithDetail = Prisma.AssessmentGetPayload<{
  include: typeof assessmentDetailInclude;
}>;
type AssessmentRow = Prisma.AssessmentGetPayload<object>;

@Injectable()
export class AssessmentsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly studentAccess: StudentAccessService,
    private readonly consent: ConsentService,
    private readonly audit: AuditLogService,
    private readonly storage: StorageService,
  ) {}

  async create(
    studentId: string,
    trainerId: string,
    input: CreateAssessmentInput,
  ): Promise<AssessmentDetailDto> {
    await this.studentAccess.assertCanAccessStudent(studentId, trainerId, Role.TRAINER);

    const student = await this.db.studentProfile.findUniqueOrThrow({
      where: { userId: studentId },
    });
    if (input.protocol !== 'NONE' && student.sex == null) {
      throw new UnprocessableEntityException(
        'Sexo do aluno não cadastrado — necessário para calcular o protocolo de dobras.',
      );
    }
    const ageYears = student.birthDate ? ageInYearsAt(student.birthDate, input.assessedAt) : null;

    let result: ReturnType<typeof calculateBodyComposition>;
    try {
      result = calculateBodyComposition({
        protocol: input.protocol,
        sex: student.sex ?? 'MALE',
        ageYears,
        skinfoldsMm: input.skinfoldsMm,
        weightKg: input.weightKg,
        heightCm: input.heightCm,
      });
    } catch (error) {
      if (error instanceof CalcValidationError) {
        throw new UnprocessableEntityException({ message: error.message, ...error.details });
      }
      throw error;
    }

    const measurements = Object.entries(input.measurementsCm ?? {});
    const skinfolds = Object.entries(input.skinfoldsMm ?? {});

    const created = await this.db.assessment.create({
      data: {
        tenantId: this.tenantContext.getTenantId(),
        studentId,
        trainerId,
        assessedAt: input.assessedAt,
        protocol: input.protocol,
        weightKg: input.weightKg,
        heightCm: input.heightCm,
        bmi: result.bmi,
        bodyFatPct: result.bodyFatPct,
        fatMassKg: result.fatMassKg,
        leanMassKg: result.leanMassKg,
        restingHr: input.restingHr,
        bloodPressure: input.bloodPressure,
        notes: input.notes,
        measurements: {
          createMany: { data: measurements.map(([site, valueCm]) => ({ site, valueCm })) },
        },
        skinfolds: {
          createMany: { data: skinfolds.map(([site, valueMm]) => ({ site, valueMm })) },
        },
      },
      include: assessmentDetailInclude,
    });

    return this.toDetailDto(created);
  }

  async list(
    studentId: string,
    callerUserId: string,
    callerRole: Role,
    query: ListAssessmentsQuery,
  ): Promise<ListAssessmentsResponseDto> {
    await this.studentAccess.assertCanAccessStudent(studentId, callerUserId, callerRole);

    const rows = await this.db.assessment.findMany({
      where: { studentId },
      orderBy: [{ assessedAt: 'desc' }, { id: 'asc' }],
      take: query.limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map((row) => this.toSummaryDto(row)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async findOne(
    assessmentId: string,
    callerUserId: string,
    callerRole: Role,
    ip: string | undefined,
  ): Promise<AssessmentDetailDto> {
    const row = await this.loadDetailRow(assessmentId);
    await this.studentAccess.assertCanAccessStudent(row.studentId, callerUserId, callerRole);
    if (callerRole === Role.TRAINER && row.photos.length > 0) {
      await this.audit.recordSensitiveRead(callerUserId, 'AssessmentPhoto', row.id, ip);
    }
    return this.toDetailDto(row);
  }

  async compare(
    callerUserId: string,
    callerRole: Role,
    query: CompareAssessmentsQuery,
  ): Promise<AssessmentCompareDto> {
    const [a, b] = await Promise.all([this.loadDetailRow(query.a), this.loadDetailRow(query.b)]);
    if (a.studentId !== b.studentId) {
      throw new NotFoundException('Avaliação não encontrada.');
    }
    await this.studentAccess.assertCanAccessStudent(a.studentId, callerUserId, callerRole);

    if (callerRole === Role.TRAINER) {
      if (a.photos.length > 0)
        await this.audit.recordSensitiveRead(callerUserId, 'AssessmentPhoto', a.id);
      if (b.photos.length > 0)
        await this.audit.recordSensitiveRead(callerUserId, 'AssessmentPhoto', b.id);
    }

    const aDto = await this.toDetailDto(a);
    const bDto = await this.toDetailDto(b);
    return { a: aDto, b: bDto, diff: diffAssessments(aDto, bDto) };
  }

  async addPhoto(
    assessmentId: string,
    trainerId: string,
    input: AddAssessmentPhotoInput,
    ctx: ConsentContext,
  ): Promise<AssessmentPhotoDto> {
    const assessment = await this.db.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException('Avaliação não encontrada.');
    await this.studentAccess.assertCanAccessStudent(assessment.studentId, trainerId, Role.TRAINER);
    // The photo is of the student's body — consent belongs to them, the titular.
    await this.consent.requireConsent(
      assessment.studentId,
      ConsentType.PHOTO,
      input.photoConsent.accepted,
      ctx,
    );

    const photo = await this.db.assessmentPhoto.create({
      data: { assessmentId, pose: input.pose, fileKey: input.fileKey },
    });

    return {
      id: photo.id,
      pose: photo.pose,
      url: await this.storage.presignGet(photo.fileKey),
      takenAt: photo.takenAt.toISOString(),
    };
  }

  async pdf(
    assessmentId: string,
    callerUserId: string,
    callerRole: Role,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.loadDetailRow(assessmentId);
    await this.studentAccess.assertCanAccessStudent(row.studentId, callerUserId, callerRole);

    const [student, trainer, detail] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id: row.studentId }, select: { name: true } }),
      this.db.user.findUniqueOrThrow({ where: { id: row.trainerId }, select: { name: true } }),
      this.toDetailDto(row),
    ]);

    const photos = await Promise.all(
      detail.photos.map(async (photo) => ({
        pose: photo.pose,
        buffer: Buffer.from(await (await fetch(photo.url)).arrayBuffer()),
      })),
    );

    const buffer = await buildAssessmentPdf({
      studentName: student.name,
      trainerName: trainer.name,
      assessment: detail,
      photos,
    });

    return { buffer, filename: `avaliacao-${row.id}.pdf` };
  }

  private async loadDetailRow(id: string): Promise<AssessmentWithDetail> {
    const row = await this.db.assessment.findUnique({
      where: { id },
      include: assessmentDetailInclude,
    });
    if (!row) throw new NotFoundException('Avaliação não encontrada.');
    return row;
  }

  private toSummaryDto(row: AssessmentRow): AssessmentSummaryDto {
    return {
      id: row.id,
      assessedAt: row.assessedAt.toISOString(),
      protocol: row.protocol,
      weightKg: row.weightKg,
      bodyFatPct: row.bodyFatPct,
      bmi: row.bmi,
    };
  }

  private async toDetailDto(row: AssessmentWithDetail): Promise<AssessmentDetailDto> {
    const photos = await Promise.all(
      row.photos.map(async (photo) => ({
        id: photo.id,
        pose: photo.pose,
        url: await this.storage.presignGet(photo.fileKey),
        takenAt: photo.takenAt.toISOString(),
      })),
    );

    return {
      ...this.toSummaryDto(row),
      heightCm: row.heightCm,
      fatMassKg: row.fatMassKg,
      leanMassKg: row.leanMassKg,
      restingHr: row.restingHr,
      bloodPressure: row.bloodPressure,
      notes: row.notes,
      measurements: row.measurements.map((m) => ({ site: m.site, valueCm: m.valueCm })),
      skinfolds: row.skinfolds.map((s) => ({ site: s.site as SkinfoldSite, valueMm: s.valueMm })),
      photos,
    };
  }
}

function ageInYearsAt(birthDate: Date, at: Date): number {
  let age = at.getUTCFullYear() - birthDate.getUTCFullYear();
  const hadBirthdayThisYear =
    at.getUTCMonth() > birthDate.getUTCMonth() ||
    (at.getUTCMonth() === birthDate.getUTCMonth() && at.getUTCDate() >= birthDate.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

function diffAssessments(a: AssessmentDetailDto, b: AssessmentDetailDto): AssessmentCompareDiffDto {
  const delta = (x: number | null, y: number | null) => (x != null && y != null ? y - x : null);

  const measurements: Array<{ site: string; deltaCm: number }> = [];
  const bBySite = new Map(b.measurements.map((m) => [m.site, m.valueCm]));
  for (const m of a.measurements) {
    const bValue = bBySite.get(m.site);
    if (bValue != null) measurements.push({ site: m.site, deltaCm: bValue - m.valueCm });
  }

  return {
    weightKg: delta(a.weightKg, b.weightKg),
    bodyFatPct: delta(a.bodyFatPct, b.bodyFatPct),
    fatMassKg: delta(a.fatMassKg, b.fatMassKg),
    leanMassKg: delta(a.leanMassKg, b.leanMassKg),
    bmi: delta(a.bmi, b.bmi),
    measurements,
  };
}
