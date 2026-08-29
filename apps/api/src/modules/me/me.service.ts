import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { type DataExportDto, type MyProfileDto, type UpdateMyProfileInput } from '@pt/shared';
import { verifyPassword } from '../../common/auth/password';
import { TokenService } from '../../common/auth/token.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { StorageService } from '../../common/storage/storage.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

@Injectable()
export class MeService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly encryption: FieldEncryptionService,
    private readonly storage: StorageService,
    private readonly tokens: TokenService,
  ) {}

  async profile(userId: string): Promise<MyProfileDto> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        consents: { orderBy: { acceptedAt: 'desc' } },
        studentProfile: { include: { trainer: { select: { name: true } } } },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      // Avatars live in private object storage; the browser only ever sees a short-lived
      // presigned URL (spec §10).
      avatarUrl: user.avatarKey ? await this.storage.presignGet(user.avatarKey) : null,
      createdAt: user.createdAt.toISOString(),
      student: user.studentProfile
        ? {
            trainerId: user.studentProfile.trainerId,
            trainerName: user.studentProfile.trainer.name,
            birthDate: user.studentProfile.birthDate?.toISOString() ?? null,
            sex: user.studentProfile.sex,
            heightCm: user.studentProfile.heightCm,
            goal: user.studentProfile.goal,
            experienceLevel: user.studentProfile.experienceLevel,
            weeklyAvailability: user.studentProfile.weeklyAvailability,
            startedAt: user.studentProfile.startedAt.toISOString(),
          }
        : null,
      consents: user.consents.map((consent) => ({
        type: consent.type,
        version: consent.version,
        acceptedAt: consent.acceptedAt.toISOString(),
        revokedAt: consent.revokedAt?.toISOString() ?? null,
      })),
    };
  }

  async updateProfile(userId: string, input: UpdateMyProfileInput): Promise<MyProfileDto> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const userData: { name?: string; phone?: string | null } = {};
    if (input.name !== undefined) userData.name = input.name;
    if (input.phone !== undefined) userData.phone = input.phone ?? null;
    if (Object.keys(userData).length > 0) {
      await this.db.user.update({ where: { id: userId }, data: userData });
    }

    // The measurement fields belong to the student profile; a trainer simply has none,
    // and silently accepting them would be a lie.
    if (user.studentProfile) {
      const profileData: Record<string, unknown> = {};
      if (input.birthDate !== undefined) profileData.birthDate = input.birthDate ?? null;
      if (input.sex !== undefined) profileData.sex = input.sex ?? null;
      if (input.heightCm !== undefined) profileData.heightCm = input.heightCm ?? null;
      if (input.goal !== undefined) profileData.goal = input.goal ?? null;
      if (input.experienceLevel !== undefined) profileData.experienceLevel = input.experienceLevel;
      if (input.weeklyAvailability !== undefined) {
        profileData.weeklyAvailability = input.weeklyAvailability ?? null;
      }
      if (Object.keys(profileData).length > 0) {
        await this.db.studentProfile.update({ where: { userId }, data: profileData });
      }
    }

    return this.profile(userId);
  }

  /**
   * LGPD art. 18, V (spec §10.4): everything the platform holds about the data subject,
   * in a machine-readable format. Sensitive fields are decrypted here — the export goes
   * to the owner of the data, who is entitled to read it in the clear.
   */
  async exportData(userId: string): Promise<DataExportDto> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { consents: true, studentProfile: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const isStudent = Boolean(user.studentProfile);
    const [anamneses, assessments, checkIns, sessions, personalRecords, notifications] =
      await Promise.all([
        isStudent ? this.db.anamnesis.findMany({ where: { studentId: userId } }) : [],
        isStudent
          ? this.db.assessment.findMany({
              where: { studentId: userId },
              include: { photos: true, skinfolds: true, measurements: true },
            })
          : [],
        isStudent ? this.db.checkIn.findMany({ where: { studentId: userId } }) : [],
        isStudent
          ? this.db.workoutSession.findMany({
              where: { studentId: userId },
              include: { exercises: { include: { sets: true } } },
            })
          : [],
        isStudent ? this.db.personalRecord.findMany({ where: { studentId: userId } }) : [],
        this.db.notification.findMany({ where: { userId } }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      format: 'json',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      studentProfile: user.studentProfile
        ? {
            birthDate: user.studentProfile.birthDate?.toISOString() ?? null,
            sex: user.studentProfile.sex,
            heightCm: user.studentProfile.heightCm,
            goal: user.studentProfile.goal,
            experienceLevel: user.studentProfile.experienceLevel,
            weeklyAvailability: user.studentProfile.weeklyAvailability,
            startedAt: user.studentProfile.startedAt.toISOString(),
          }
        : null,
      consents: user.consents.map((consent) => ({
        type: consent.type,
        version: consent.version,
        acceptedAt: consent.acceptedAt.toISOString(),
        revokedAt: consent.revokedAt?.toISOString() ?? null,
      })),
      anamneses: anamneses.map((row) => ({
        version: row.version,
        answeredAt: row.answeredAt.toISOString(),
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
      })),
      assessments: assessments.map((row) => ({
        id: row.id,
        assessedAt: row.assessedAt.toISOString(),
        weightKg: row.weightKg,
        heightCm: row.heightCm,
        bodyFatPct: row.bodyFatPct,
        leanMassKg: row.leanMassKg,
        protocol: row.protocol,
        bmi: row.bmi,
        fatMassKg: row.fatMassKg,
        restingHr: row.restingHr,
        bloodPressure: row.bloodPressure,
        skinfolds: row.skinfolds.map((fold) => ({ site: fold.site, valueMm: fold.valueMm })),
        measurements: row.measurements.map((m) => ({ site: m.site, valueCm: m.valueCm })),
        notes: row.notes,
        // The photo files themselves are not inlined: they are private objects, fetched
        // one presigned URL at a time.
        photos: row.photos.map((photo) => ({
          pose: photo.pose,
          takenAt: photo.takenAt.toISOString(),
        })),
      })),
      checkIns: checkIns.map((row) => ({
        weekStart: row.weekStart.toISOString(),
        weightKg: row.weightKg,
        sleepQuality: row.sleepQuality,
        stress: row.stress,
        soreness: row.soreness,
        energy: row.energy,
        notes: row.notes,
        createdAt: row.createdAt.toISOString(),
      })),
      sessions: sessions.map((row) => ({
        id: row.id,
        status: row.status,
        startedAt: row.startedAt.toISOString(),
        finishedAt: row.finishedAt?.toISOString() ?? null,
        durationSeconds: row.durationSeconds,
        perceivedEffort: row.perceivedEffort,
        mood: row.mood,
        notes: row.notes,
        totalVolumeKg: row.totalVolumeKg,
        exercises: row.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          orderIndex: exercise.orderIndex,
          skipped: exercise.skipped,
          sets: exercise.sets.map((set) => ({
            setNumber: set.setNumber,
            setType: set.setType,
            reps: set.reps,
            loadKg: set.loadKg,
            rir: set.rir,
            rpe: set.rpe,
            seconds: set.seconds,
            distanceM: set.distanceM,
            toFailure: set.toFailure,
            estimated1rm: set.estimated1rm,
            doneAt: set.doneAt.toISOString(),
            notes: set.notes,
          })),
        })),
      })),
      personalRecords: personalRecords.map((row) => ({
        exerciseId: row.exerciseId,
        type: row.type,
        value: row.value,
        reps: row.reps,
        achievedAt: row.achievedAt.toISOString(),
      })),
      notifications: notifications.map((row) => ({
        type: row.type,
        title: row.title,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        readAt: row.readAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * LGPD art. 18, VI (spec §10.5). Restricted to students: a trainer owns the tenant's
   * programs, exercises and students, and erasing them from a self-service endpoint
   * would take an entire practice down with it.
   */
  async deleteAccount(userId: string, role: Role, password: string, ip?: string): Promise<void> {
    if (role !== Role.STUDENT) {
      throw new ForbiddenException(
        'A exclusão da conta de treinador precisa ser solicitada ao suporte.',
      );
    }

    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
      throw new UnauthorizedException('Senha incorreta.');
    }

    // Written before the cascade, and with `actorId` null, so the record survives the
    // deletion of the very user it is about.
    await this.db.auditLog.create({
      data: {
        tenantId: this.tenantContext.getTenantId(),
        actorId: null,
        action: 'DELETE_ACCOUNT',
        entity: 'User',
        entityId: userId,
        isSensitive: true,
        ip,
      },
    });

    await this.tokens.revokeAllRefreshTokens(userId);
    // Every owned row (profile, sessions, assessments, consents…) is `onDelete: Cascade`
    // from `User`, so this is a true erasure, not a soft delete.
    await this.db.user.delete({ where: { id: userId } });
  }
}
