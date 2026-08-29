import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatMinutes, formatWeight } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { useSessionHistory } from '@/features/workouts/use-workouts';
import { useStudent } from './use-student';

export function StudentHistoryTab() {
  const student = useStudent();
  const history = useSessionHistory(student.id);
  const sessions = history.data?.pages.flatMap((page) => page.items) ?? [];

  if (history.isPending) return <Skeleton className="h-48" />;
  if (history.isError) return <Alert variant="error">{problemMessage(history.error)}</Alert>;

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent>
          <CardDescription>Este aluno ainda não concluiu nenhum treino.</CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {sessions.map((session) => {
          const sets = session.exercises.reduce((total, e) => total + e.sets.length, 0);
          return (
            <li key={session.id}>
              <Link
                to={`/gestao/treinos/${session.id}`}
                className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-raised px-4 py-3 hover:border-border-strong"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{formatDateTime(session.startedAt)}</span>
                  <span className="text-xs text-text-subtle">
                    {session.exercises.length} exercícios · {sets} séries
                    {session.durationSeconds ? ` · ${formatMinutes(session.durationSeconds)}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-text-muted">
                  {session.totalVolumeKg ? formatWeight(session.totalVolumeKg) : '—'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {history.hasNextPage ? (
        <Button
          variant="secondary"
          loading={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
          className="self-start"
        >
          Carregar mais
        </Button>
      ) : null}
    </div>
  );
}
