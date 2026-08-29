import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import {
  type ListStudentsQuery,
  type ListStudentsResponseDto,
  type StudentDetailDto,
  type StudentSummaryDto,
  type UpdateStudentInput,
} from '@pt/shared';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { StudentAccessService } from '../../common/students/student-access.service';
import { startOfWeekUtc } from '../../common/util/week';

const PROFILE_INCLUDE = {
  user: true,
  programs: {
    select: { id: true, name: true, status: true, _count: { select: { days: true } } },
  },
} satisfies Prisma.StudentProfileInclude;

type ProfileRow = Prisma.StudentProfileGetPayload<{ include: typeof PROFILE_INCLUDE }>;

/**
 * The trainer's roster (spec §5 `GET /students`). Every row answers the two questions a
 * trainer actually opens this screen with — "who stopped training?" and "who is off
 * plan?" — so `lastSessionAt` and adherence are computed here rather than left to N
 * follow-up requests from the table.
 */
@Injectable()
export class StudentsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly studentAccess: StudentAccessService,
  ) {}

  async list(trainerId: string, query: ListStudentsQuery): Promise<ListStudentsResponseDto> {
    const where: Prisma.StudentProfileWhereInput = {
      trainerId,
      user: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { email: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    };

    // One extra row is fetched to decide whether a next page exists, without a count(*).
    const rows = await this.db.studentProfile.findMany({
      where,
      orderBy: { user: { name: 'asc' } },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { userId: query.cursor }, skip: 1 } : {}),
      include: PROFILE_INCLUDE,
    });

    const page = rows.slice(0, query.limit);
    const summaries = await this.summarize(page, query.weeks);

    // The activity filters run after the aggregates, because both of them are derived
    // from session history rather than from a column the database can index.
    const filtered = summaries.filter((student) => {
      if (query.maxAdherencePct != null && student.adherenceRatio * 100 > query.maxAdherencePct) {
        return false;
      }
      if (query.inactiveDays != null) {
        const threshold = Date.now() - query.inactiveDays * 24 * 60 * 60 * 1000;
        const last = student.lastSessionAt ? Date.parse(student.lastSessionAt) : 0;
        if (last > threshold) return false;
      }
      return true;
    });

    return {
      items: filtered,
      nextCursor: rows.length > query.limit ? (page[page.length - 1]?.userId ?? null) : null,
    };
  }

  async findOne(
    studentId: string,
    callerUserId: string,
    callerRole: Role,
  ): Promise<StudentDetailDto> {
    await this.studentAccess.assertCanAccessStudent(studentId, callerUserId, callerRole);

    const profile = await this.db.studentProfile.findUnique({
      where: { userId: studentId },
      include: PROFILE_INCLUDE,
    });
    if (!profile) throw new NotFoundException('Aluno não encontrado.');

    const [summary] = await this.summarize([profile], 4);
    const [lastAssessment, totalSessions] = await Promise.all([
      this.db.assessment.findFirst({
        where: { studentId },
        orderBy: { assessedAt: 'desc' },
        select: { assessedAt: true },
      }),
      this.db.workoutSession.count({ where: { studentId, status: 'COMPLETED' } }),
    ]);

    return {
      ...summary!,
      birthDate: profile.birthDate?.toISOString() ?? null,
      sex: profile.sex,
      heightCm: profile.heightCm,
      weeklyAvailability: profile.weeklyAvailability,
      // Trainer-only by construction: a student reaching their own record goes through
      // `GET /me/profile`, which has no such field.
      privateNotes: callerRole === Role.TRAINER ? profile.privateNotes : null,
      lastAssessmentAt: lastAssessment?.assessedAt.toISOString() ?? null,
      totalSessions,
    };
  }

  async update(
    studentId: string,
    trainerId: string,
    input: UpdateStudentInput,
  ): Promise<StudentDetailDto> {
    await this.studentAccess.assertCanAccessStudent(studentId, trainerId, Role.TRAINER);

    const profileData: Prisma.StudentProfileUpdateInput = {};
    if (input.goal !== undefined) profileData.goal = input.goal ?? null;
    if (input.privateNotes !== undefined) profileData.privateNotes = input.privateNotes ?? null;
    if (input.experienceLevel !== undefined) profileData.experienceLevel = input.experienceLevel;
    if (input.weeklyAvailability !== undefined) {
      profileData.weeklyAvailability = input.weeklyAvailability ?? null;
    }
    if (Object.keys(profileData).length > 0) {
      await this.db.studentProfile.update({ where: { userId: studentId }, data: profileData });
    }

    // Deactivating is how a trainer parks a student who stopped: it blocks the login
    // (`auth.service` rejects a non-ACTIVE user) without deleting any history.
    if (input.status !== undefined) {
      await this.db.user.update({ where: { id: studentId }, data: { status: input.status } });
    }

    return this.findOne(studentId, trainerId, Role.TRAINER);
  }

  /** Batched aggregates: one query per fact for the whole page, never one per student. */
  private async summarize(profiles: ProfileRow[], weeks: number): Promise<StudentSummaryDto[]> {
    if (profiles.length === 0) return [];

    const studentIds = profiles.map((profile) => profile.userId);
    const windowStart = new Date(startOfWeekUtc(new Date()));
    windowStart.setUTCDate(windowStart.getUTCDate() - (weeks - 1) * 7);
    const currentWeekStart = new Date(startOfWeekUtc(new Date()));

    const [lastSessions, completedInWindow, checkIns] = await Promise.all([
      this.db.workoutSession.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, status: 'COMPLETED' },
        _max: { finishedAt: true },
      }),
      this.db.workoutSession.groupBy({
        by: ['studentId'],
        where: {
          studentId: { in: studentIds },
          status: 'COMPLETED',
          finishedAt: { gte: windowStart },
        },
        _count: { _all: true },
      }),
      this.db.checkIn.findMany({
        where: { studentId: { in: studentIds }, weekStart: currentWeekStart },
        select: { studentId: true },
      }),
    ]);

    const lastByStudent = new Map(
      lastSessions.map((row) => [row.studentId, row._max.finishedAt ?? null]),
    );
    const doneByStudent = new Map(completedInWindow.map((row) => [row.studentId, row._count._all]));
    const checkedIn = new Set(checkIns.map((row) => row.studentId));

    return profiles.map((profile) => {
      const activeProgram = profile.programs.find((program) => program.status === 'ACTIVE') ?? null;
      // Same divisor as `progress.adherence`: the active program's day count, since
      // there is no history of which program was active in past weeks.
      const expected = activeProgram?._count.days ?? 0;
      const done = doneByStudent.get(profile.userId) ?? 0;

      return {
        id: profile.userId,
        name: profile.user.name,
        email: profile.user.email,
        phone: profile.user.phone,
        status: profile.user.status as StudentSummaryDto['status'],
        goal: profile.goal,
        experienceLevel: profile.experienceLevel,
        startedAt: profile.startedAt.toISOString(),
        lastSessionAt: lastByStudent.get(profile.userId)?.toISOString() ?? null,
        adherenceRatio: expected > 0 ? done / (expected * weeks) : 0,
        activeProgramId: activeProgram?.id ?? null,
        activeProgramName: activeProgram?.name ?? null,
        hasPendingCheckIn: !checkedIn.has(profile.userId),
      };
    });
  }
}
