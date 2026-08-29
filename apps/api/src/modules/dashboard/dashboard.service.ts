import { Inject, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  type AtRiskStudentDto,
  type DashboardResponseDto,
  type PendingCheckInDto,
  type RecentPrDto,
  type RiskReason,
  type WorkoutTodayDto,
} from '@pt/shared';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { mondayOfUtc, startOfUtcDay } from '../../common/util/week';
import { ProgressService } from '../progress/progress.service';

const MS_PER_DAY = 86_400_000;
const NO_SESSION_THRESHOLD_DAYS = 10;
const LOW_ADHERENCE_WEEKS = 3;
const LOW_ADHERENCE_THRESHOLD = 0.5;
const E1RM_WINDOW_WEEKS = 6;
const E1RM_STAGNATION_THRESHOLD = 0.6;

interface StudentRow {
  userId: string;
  user: { id: string; name: string };
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly progress: ProgressService,
  ) {}

  async getDashboard(trainerId: string): Promise<DashboardResponseDto> {
    const students: StudentRow[] = await this.db.studentProfile.findMany({
      where: { trainerId },
      include: { user: { select: { id: true, name: true } } },
    });

    const [atRiskStudents, workoutsToday, recentPRs, pendingCheckIns] = await Promise.all([
      this.computeAtRisk(students, trainerId),
      this.computeWorkoutsToday(students),
      this.computeRecentPRs(students),
      this.computePendingCheckIns(students),
    ]);

    return { atRiskStudents, workoutsToday, recentPRs, pendingCheckIns };
  }

  // ---------------------------------------------------------------- risco (spec §6)

  private async computeAtRisk(
    students: StudentRow[],
    trainerId: string,
  ): Promise<AtRiskStudentDto[]> {
    const results: AtRiskStudentDto[] = [];

    for (const student of students) {
      const reasons: RiskReason[] = [];

      const lastSession = await this.db.workoutSession.findFirst({
        where: { studentId: student.userId, status: 'COMPLETED' },
        orderBy: { finishedAt: 'desc' },
      });
      if (
        !lastSession?.finishedAt ||
        (Date.now() - lastSession.finishedAt.getTime()) / MS_PER_DAY >= NO_SESSION_THRESHOLD_DAYS
      ) {
        reasons.push('NO_SESSION_10_DAYS');
      }

      const weeks = await this.progress.adherence(
        student.userId,
        { weeks: LOW_ADHERENCE_WEEKS },
        trainerId,
        Role.TRAINER,
      );
      const avgAdherence = weeks.reduce((sum, w) => sum + w.adherencePct, 0) / weeks.length;
      if (avgAdherence < LOW_ADHERENCE_THRESHOLD) reasons.push('LOW_ADHERENCE');

      if (await this.isE1rmStagnant(student.userId)) reasons.push('E1RM_STAGNATION');
      if (await this.isSorenessOrStressHigh(student.userId))
        reasons.push('HIGH_SORENESS_OR_STRESS');

      if (reasons.length > 0) {
        results.push({ studentId: student.userId, studentName: student.user.name, reasons });
      }
    }

    return results;
  }

  /**
   * "Exercícios principais" = todos os exercícios prescritos no programa ativo.
   * "Avaliável" = pelo menos 2 pontos de `estimated1rm` na janela de 6 semanas.
   * "Estagnado ou em queda" = valor mais recente &lt;= valor mais antigo da janela.
   * Sem exercícios avaliáveis, o critério não dispara (falta de dado != risco).
   */
  private async isE1rmStagnant(studentId: string): Promise<boolean> {
    const program = await this.db.program.findFirst({
      where: { studentId, status: 'ACTIVE' },
      include: { days: { include: { exercises: { select: { exerciseId: true } } } } },
    });
    if (!program) return false;

    const exerciseIds = [
      ...new Set(program.days.flatMap((day) => day.exercises.map((e) => e.exerciseId))),
    ];
    if (exerciseIds.length === 0) return false;

    const since = new Date(Date.now() - E1RM_WINDOW_WEEKS * 7 * MS_PER_DAY);

    let evaluable = 0;
    let stagnant = 0;
    for (const exerciseId of exerciseIds) {
      const sets = await this.db.setLog.findMany({
        where: {
          estimated1rm: { not: null },
          doneAt: { gte: since },
          sessionExercise: { exerciseId, session: { studentId } },
        },
        orderBy: { doneAt: 'asc' },
        select: { estimated1rm: true },
      });
      if (sets.length < 2) continue;

      evaluable += 1;
      const first = sets[0].estimated1rm!;
      const last = sets[sets.length - 1].estimated1rm!;
      if (last <= first) stagnant += 1;
    }

    return evaluable > 0 && stagnant / evaluable >= E1RM_STAGNATION_THRESHOLD;
  }

  /** Duas semanas consecutivas com soreness ou stress >= 4. */
  private async isSorenessOrStressHigh(studentId: string): Promise<boolean> {
    const checkIns = await this.db.checkIn.findMany({
      where: { studentId },
      orderBy: { weekStart: 'desc' },
      take: 8,
      select: { weekStart: true, soreness: true, stress: true },
    });

    for (let i = 0; i < checkIns.length - 1; i++) {
      const a = checkIns[i];
      const b = checkIns[i + 1];
      const consecutive = a.weekStart.getTime() - b.weekStart.getTime() === 7 * MS_PER_DAY;
      const aHigh = (a.soreness ?? 0) >= 4 || (a.stress ?? 0) >= 4;
      const bHigh = (b.soreness ?? 0) >= 4 || (b.stress ?? 0) >= 4;
      if (consecutive && aHigh && bHigh) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- outros widgets

  private async computeWorkoutsToday(students: StudentRow[]): Promise<WorkoutTodayDto[]> {
    if (students.length === 0) return [];
    const startOfDay = startOfUtcDay(new Date());

    const sessions = await this.db.workoutSession.findMany({
      where: {
        studentId: { in: students.map((s) => s.userId) },
        startedAt: { gte: startOfDay },
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true, studentId: true, status: true },
    });
    const byStudent = new Map<string, { id: string; status: string }>();
    for (const session of sessions) {
      if (!byStudent.has(session.studentId)) {
        byStudent.set(session.studentId, { id: session.id, status: session.status });
      }
    }

    return students.map((student) => {
      const session = byStudent.get(student.userId);
      return {
        studentId: student.userId,
        studentName: student.user.name,
        status: session
          ? session.status === 'COMPLETED'
            ? 'COMPLETED'
            : 'IN_PROGRESS'
          : 'NOT_STARTED',
        sessionId: session?.id ?? null,
      };
    });
  }

  private async computeRecentPRs(students: StudentRow[]): Promise<RecentPrDto[]> {
    if (students.length === 0) return [];
    const sevenDaysAgo = new Date(Date.now() - 7 * MS_PER_DAY);
    const studentsById = new Map(students.map((s) => [s.userId, s.user.name]));

    const rows = await this.db.personalRecord.findMany({
      where: {
        studentId: { in: students.map((s) => s.userId) },
        achievedAt: { gte: sevenDaysAgo },
      },
      orderBy: { achievedAt: 'desc' },
      include: { exercise: { select: { name: true } } },
    });

    return rows.map((row) => ({
      studentId: row.studentId,
      studentName: studentsById.get(row.studentId) ?? '',
      exerciseId: row.exerciseId,
      exerciseName: row.exercise.name,
      type: row.type,
      value: row.value,
      achievedAt: row.achievedAt.toISOString(),
    }));
  }

  private async computePendingCheckIns(students: StudentRow[]): Promise<PendingCheckInDto[]> {
    if (students.length === 0) return [];
    const weekStart = new Date(mondayOfUtc(new Date()));

    const submitted = await this.db.checkIn.findMany({
      where: { studentId: { in: students.map((s) => s.userId) }, weekStart },
      select: { studentId: true },
    });
    const submittedIds = new Set(submitted.map((row) => row.studentId));

    return students
      .filter((student) => !submittedIds.has(student.userId))
      .map((student) => ({ studentId: student.userId, studentName: student.user.name }));
  }
}
