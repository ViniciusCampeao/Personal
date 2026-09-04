import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { AdherenceWeekDto, PersonalRecordDto } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, formatWeekday, formatWeight } from '@/lib/format';
import { PR_TYPE_LABELS, labelOf } from '@/lib/labels';
import { problemMessage } from '@/lib/problem';
import { PATHS } from '@/routes/paths';
import { useAuth } from '@/features/auth/auth-context';
import { fetchCurrentCheckIn } from '@/features/checkins/checkins-api';
import { useActiveSession, useToday } from '@/features/workouts/use-workouts';
import { startSession } from '@/features/workouts/workout-store';
import { PageHeader } from '@/components/app/page-header';

export function StudentHomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = useToday();
  const active = useActiveSession();

  async function handleStart() {
    if (active) {
      navigate(PATHS.studentSession(active.clientUuid));
      return;
    }
    if (!today.data) return;
    const session = await startSession(today.data);
    navigate(PATHS.studentSession(session.clientUuid));
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Olá, ${user?.name?.split(' ')[0] ?? ''}`}
        description={`${formatWeekday(new Date())}, ${formatDate(new Date())}`}
      />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <CardTitle>Treino de hoje</CardTitle>

          {today.isPending ? (
            <Skeleton className="h-16" />
          ) : today.isError ? (
            <Alert variant="error">{problemMessage(today.error)}</Alert>
          ) : !today.data.hasActiveProgram ? (
            <CardDescription>Seu treinador ainda não ativou um programa para você.</CardDescription>
          ) : today.data.exercises.length === 0 ? (
            <CardDescription>O treino de hoje ainda não tem exercícios.</CardDescription>
          ) : (
            <>
              <CardDescription>
                {today.data.dayLabel} · {today.data.exercises.length}{' '}
                {today.data.exercises.length === 1 ? 'exercício' : 'exercícios'}
              </CardDescription>
              <ul className="flex flex-col gap-1 text-sm text-text-muted">
                {today.data.exercises.slice(0, 4).map((exercise) => (
                  <li key={exercise.prescribedExerciseId} className="truncate">
                    {exercise.exerciseName}
                  </li>
                ))}
                {today.data.exercises.length > 4 ? (
                  <li className="text-text-subtle">
                    +{today.data.exercises.length - 4} exercícios
                  </li>
                ) : null}
              </ul>
              <Button size="xl" onClick={() => void handleStart()}>
                {active ? 'Continuar treino' : 'Começar treino'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <CheckInCard />

      <NavCard
        to={PATHS.studentDiet}
        title="Dieta"
        description="Veja o plano montado pelo seu treinador."
      />
      <NavCard
        to={PATHS.studentAgenda}
        title="Agenda"
        description="Seus próximos treinos e reuniões."
      />

      <AdherenceCard studentId={user?.id} />
      <LastRecordCard studentId={user?.id} />
    </div>
  );
}

/** The weekly check-in has no tab of its own; this is how a student finds it. */
function CheckInCard() {
  const current = useQuery({
    queryKey: ['me', 'check-in', 'current'],
    queryFn: fetchCurrentCheckIn,
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <CardTitle>Check-in da semana</CardTitle>
        {current.isPending ? (
          <Skeleton className="h-10" />
        ) : current.data ? (
          <CardDescription>
            Respondido em {formatDate(current.data.createdAt)}. Você ainda pode ajustar.
          </CardDescription>
        ) : (
          <CardDescription>Como foi sua semana? Leva menos de um minuto.</CardDescription>
        )}
        {/* A navigation, so it is a link wearing the button's clothes, not a button. */}
        <Link
          to={PATHS.studentCheckIn}
          className={cn(buttonVariants({ variant: 'secondary' }), 'self-start')}
        >
          {current.data ? 'Revisar check-in' : 'Fazer check-in'}
        </Link>
      </CardContent>
    </Card>
  );
}

/** Same reasoning as `CheckInCard`: no tab of its own, reached from here instead. */
function NavCard({ to, title, description }: { to: string; title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <Link to={to} className={cn(buttonVariants({ variant: 'secondary' }), 'self-start')}>
          Ver
        </Link>
      </CardContent>
    </Card>
  );
}

function AdherenceCard({ studentId }: { studentId: string | undefined }) {
  const query = useQuery({
    queryKey: ['students', studentId, 'adherence', 4],
    enabled: Boolean(studentId),
    queryFn: () =>
      apiFetch<AdherenceWeekDto[]>(`/students/${studentId}/progress/adherence?weeks=4`),
  });

  const weeks = query.data ?? [];
  const average =
    weeks.length > 0
      ? Math.round(
          (weeks.reduce((total, week) => total + week.adherenceRatio, 0) / weeks.length) * 100,
        )
      : null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <CardTitle>Aderência</CardTitle>
        {query.isPending ? (
          <Skeleton className="h-12" />
        ) : query.isError ? (
          <CardDescription>{problemMessage(query.error)}</CardDescription>
        ) : weeks.length === 0 ? (
          <CardDescription>Sem treinos registrados ainda.</CardDescription>
        ) : (
          <>
            <CardDescription>{average}% nas últimas 4 semanas</CardDescription>
            <ul className="flex items-end gap-2" aria-hidden="true">
              {weeks.map((week) => (
                <li
                  key={week.weekStart}
                  className="flex h-16 flex-1 items-end rounded bg-surface-sunken"
                >
                  <div
                    className="w-full rounded bg-accent"
                    style={{ height: `${Math.min(100, Math.round(week.adherenceRatio * 100))}%` }}
                  />
                </li>
              ))}
            </ul>
            <p className="sr-only">
              {weeks
                .map(
                  (week) =>
                    `Semana de ${formatDate(week.weekStart)}: ${week.completedSessions} de ${week.expectedSessions} treinos.`,
                )
                .join(' ')}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LastRecordCard({ studentId }: { studentId: string | undefined }) {
  const query = useQuery({
    queryKey: ['students', studentId, 'records'],
    enabled: Boolean(studentId),
    queryFn: () => apiFetch<PersonalRecordDto[]>(`/students/${studentId}/records`),
  });

  const record = query.data?.[0];

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <CardTitle>Último recorde</CardTitle>
        {query.isPending ? (
          <Skeleton className="h-10" />
        ) : !record ? (
          <CardDescription>Seu primeiro PR aparece aqui.</CardDescription>
        ) : (
          <>
            <p className="text-base font-medium">{record.exerciseName}</p>
            <CardDescription>
              {labelOf(PR_TYPE_LABELS, record.type)} ·{' '}
              {record.type === 'MAX_REPS' ? `${record.value} reps` : formatWeight(record.value)} ·{' '}
              {formatDate(record.achievedAt)}
            </CardDescription>
          </>
        )}
      </CardContent>
    </Card>
  );
}
