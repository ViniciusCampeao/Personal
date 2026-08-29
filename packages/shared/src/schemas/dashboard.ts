import { type prTypes } from './sessions';

/** Spec §6 "aluno em risco" — which of the four criteria fired for a given student. */
export const riskReasons = [
  'NO_SESSION_10_DAYS',
  'LOW_ADHERENCE',
  'E1RM_STAGNATION',
  'HIGH_SORENESS_OR_STRESS',
] as const;
export type RiskReason = (typeof riskReasons)[number];

export interface AtRiskStudentDto {
  studentId: string;
  studentName: string;
  reasons: RiskReason[];
}

export interface WorkoutTodayDto {
  studentId: string;
  studentName: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';
  sessionId: string | null;
}

export interface RecentPrDto {
  studentId: string;
  studentName: string;
  exerciseId: string;
  exerciseName: string;
  type: (typeof prTypes)[number];
  value: number;
  achievedAt: string;
}

export interface PendingCheckInDto {
  studentId: string;
  studentName: string;
}

/** `GET /dashboard` (trainer-only) — no request schema, always scoped to the caller. */
export interface DashboardResponseDto {
  atRiskStudents: AtRiskStudentDto[];
  workoutsToday: WorkoutTodayDto[];
  recentPRs: RecentPrDto[];
  pendingCheckIns: PendingCheckInDto[];
}
