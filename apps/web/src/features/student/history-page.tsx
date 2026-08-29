import { Link } from 'react-router-dom';
import type { SessionDto } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatMinutes, formatWeight } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { PATHS } from '@/routes/paths';
import { useAuth } from '@/features/auth/auth-context';
import { useSessionHistory } from '@/features/workouts/use-workouts';

export function HistoryPage() {
  const { user } = useAuth();
  const history = useSessionHistory(user?.id);
  const sessions = history.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Histórico</h1>

      {history.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : history.isError ? (
        <Alert variant="error">{problemMessage(history.error)}</Alert>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent>
            <CardDescription>
              Seus treinos aparecem aqui assim que você concluir o primeiro.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li key={session.id}>
              <SessionRow session={session} />
            </li>
          ))}
        </ul>
      )}

      {history.hasNextPage ? (
        <Button
          variant="secondary"
          loading={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
        >
          Carregar mais
        </Button>
      ) : null}
    </div>
  );
}

const STATUS_LABELS: Record<SessionDto['status'], string> = {
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
  ABANDONED: 'Abandonado',
  SKIPPED: 'Pulado',
};

function SessionRow({ session }: { session: SessionDto }) {
  const setCount = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  return (
    <Link
      to={PATHS.studentSessionDetail(session.id)}
      className="block rounded-card border border-border bg-surface-raised p-4 active:bg-surface-sunken"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle>{formatDateTime(session.startedAt)}</CardTitle>
          <CardDescription>
            {session.exercises.length} {session.exercises.length === 1 ? 'exercício' : 'exercícios'}{' '}
            · {setCount} {setCount === 1 ? 'série' : 'séries'}
            {session.durationSeconds ? ` · ${formatMinutes(session.durationSeconds)}` : ''}
          </CardDescription>
        </div>
        <span className="shrink-0 text-xs text-text-subtle">{STATUS_LABELS[session.status]}</span>
      </div>
      {session.totalVolumeKg ? (
        <p className="mt-2 text-sm text-text-muted">
          Volume total {formatWeight(session.totalVolumeKg)}
        </p>
      ) : null}
    </Link>
  );
}
