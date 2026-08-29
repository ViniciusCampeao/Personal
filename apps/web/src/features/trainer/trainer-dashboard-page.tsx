import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  AtRiskStudentDto,
  DashboardResponseDto,
  RiskReason,
  WorkoutTodayDto,
} from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeDay, formatWeight } from '@/lib/format';
import { PR_TYPE_LABELS, labelOf } from '@/lib/labels';
import { problemMessage } from '@/lib/problem';
import { PATHS } from '@/routes/paths';
import { fetchDashboard } from './trainer-api';

/** Spec §6: the four criteria that put a student on the risk list, in the trainer's words. */
const RISK_LABELS: Record<RiskReason, string> = {
  NO_SESSION_10_DAYS: 'Sem treinar há 10 dias',
  LOW_ADHERENCE: 'Aderência baixa',
  E1RM_STAGNATION: 'Carga estagnada',
  HIGH_SORENESS_OR_STRESS: 'Dor ou estresse altos',
};

const WORKOUT_STATUS: Record<WorkoutTodayDto['status'], { label: string; tone: string }> = {
  COMPLETED: { label: 'Concluído', tone: 'text-success' },
  IN_PROGRESS: { label: 'Em andamento', tone: 'text-accent' },
  NOT_STARTED: { label: 'Não iniciado', tone: 'text-text-subtle' },
};

export function TrainerDashboardPage() {
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard });

  if (dashboard.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (dashboard.isError) return <Alert variant="error">{problemMessage(dashboard.error)}</Alert>;

  const data = dashboard.data;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <Summary data={data} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AtRiskPanel students={data.atRiskStudents} />
        <TodayPanel workouts={data.workoutsToday} />
        <RecentPrsPanel prs={data.recentPRs} />
        <PendingCheckInsPanel students={data.pendingCheckIns} />
      </div>
    </div>
  );
}

/**
 * Four counts, not four charts: at this size the number *is* the visualization, and a
 * bar of one value would be decoration.
 */
function Summary({ data }: { data: DashboardResponseDto }) {
  const tiles = [
    { label: 'Alunos em risco', value: data.atRiskStudents.length, tone: 'text-warning' },
    {
      label: 'Treinos concluídos hoje',
      value: data.workoutsToday.filter((w) => w.status === 'COMPLETED').length,
      tone: 'text-text',
    },
    { label: 'PRs recentes', value: data.recentPRs.length, tone: 'text-success' },
    { label: 'Check-ins pendentes', value: data.pendingCheckIns.length, tone: 'text-text' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label}>
          <CardContent className="flex flex-col gap-1">
            <span className="text-sm text-text-muted">{tile.label}</span>
            <span className={`text-3xl font-semibold tabular-nums ${tile.tone}`}>{tile.value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Panel({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <CardTitle>{title}</CardTitle>
        {hasChildren ? (
          <ul className="flex flex-col divide-y divide-border">{children}</ul>
        ) : (
          <CardDescription>{empty}</CardDescription>
        )}
      </CardContent>
    </Card>
  );
}

function StudentRow({
  studentId,
  name,
  detail,
  trailing,
}: {
  studentId: string;
  name: string;
  detail?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <li>
      <Link
        to={PATHS.trainerStudent(studentId)}
        className="flex min-h-touch items-center justify-between gap-3 py-2"
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{name}</span>
          {detail ? <span className="text-xs text-text-subtle">{detail}</span> : null}
        </span>
        {trailing}
      </Link>
    </li>
  );
}

function AtRiskPanel({ students }: { students: AtRiskStudentDto[] }) {
  return (
    <Panel title="Alunos em risco" empty="Ninguém em risco no momento.">
      {students.map((student) => (
        <StudentRow
          key={student.studentId}
          studentId={student.studentId}
          name={student.studentName}
          detail={
            <span className="flex flex-wrap gap-1">
              {student.reasons.map((reason) => (
                <span
                  key={reason}
                  className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning"
                >
                  {RISK_LABELS[reason]}
                </span>
              ))}
            </span>
          }
        />
      ))}
    </Panel>
  );
}

function TodayPanel({ workouts }: { workouts: WorkoutTodayDto[] }) {
  return (
    <Panel title="Treinos de hoje" empty="Nenhum treino previsto para hoje.">
      {workouts.map((workout) => {
        const status = WORKOUT_STATUS[workout.status];
        return (
          <StudentRow
            key={workout.studentId}
            studentId={workout.studentId}
            name={workout.studentName}
            trailing={<span className={`shrink-0 text-xs ${status.tone}`}>{status.label}</span>}
          />
        );
      })}
    </Panel>
  );
}

function RecentPrsPanel({ prs }: { prs: DashboardResponseDto['recentPRs'] }) {
  return (
    <Panel title="PRs recentes" empty="Nenhum recorde novo nesta semana.">
      {prs.map((pr) => (
        <StudentRow
          key={`${pr.studentId}-${pr.exerciseId}-${pr.type}`}
          studentId={pr.studentId}
          name={pr.studentName}
          detail={`${pr.exerciseName} · ${labelOf(PR_TYPE_LABELS, pr.type)}`}
          trailing={
            <span className="shrink-0 text-right text-xs">
              <span className="block font-semibold text-success">
                {pr.type === 'MAX_REPS' ? `${pr.value} reps` : formatWeight(pr.value)}
              </span>
              <span className="text-text-subtle">{formatRelativeDay(pr.achievedAt)}</span>
            </span>
          }
        />
      ))}
    </Panel>
  );
}

function PendingCheckInsPanel({ students }: { students: DashboardResponseDto['pendingCheckIns'] }) {
  return (
    <Panel title="Check-ins pendentes" empty="Todos os alunos responderam esta semana.">
      {students.map((student) => (
        <StudentRow
          key={student.studentId}
          studentId={student.studentId}
          name={student.studentName}
        />
      ))}
    </Panel>
  );
}
