import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatMinutes, formatWeight } from '@/lib/format';
import { SET_TYPE_LABELS, labelOf } from '@/lib/labels';
import { problemMessage } from '@/lib/problem';
import { BackLink } from '@/components/app/back-link';
import { fetchSession } from '@/features/workouts/workouts-api';
import { PageHeader } from '@/components/app/page-header';

export function SessionDetailPage() {
  const { id = '' } = useParams();
  const session = useQuery({
    queryKey: ['sessions', id],
    queryFn: () => fetchSession(id),
  });

  if (session.isPending) return <Skeleton className="h-64" />;
  if (session.isError) return <Alert variant="error">{problemMessage(session.error)}</Alert>;

  const data = session.data;

  return (
    <div className="flex flex-col gap-4">
      <BackLink label="Voltar" />

      <header className="flex flex-col gap-1">
        <PageHeader
          title={formatDateTime(data.startedAt)}
          description={
            <span className="tabular-nums">
              {data.durationSeconds ? `${formatMinutes(data.durationSeconds)} · ` : ''}
              {data.totalVolumeKg ? `volume ${formatWeight(data.totalVolumeKg)}` : 'sem volume'}
              {data.perceivedEffort ? ` · esforço ${data.perceivedEffort}/10` : ''}
            </span>
          }
        />
        {data.notes ? <p className="text-sm text-text-muted">{data.notes}</p> : null}
      </header>

      <ul className="flex flex-col gap-3">
        {data.exercises.map((exercise) => (
          <li key={exercise.id}>
            <Card>
              <CardContent className="flex flex-col gap-2">
                <CardTitle>{exercise.exerciseName}</CardTitle>
                {exercise.substitutedFromExerciseId ? (
                  <CardDescription>
                    Substituição
                    {exercise.substitutionReason ? ` — ${exercise.substitutionReason}` : ''}
                  </CardDescription>
                ) : null}
                {exercise.sets.length === 0 ? (
                  <CardDescription>Nenhuma série registrada.</CardDescription>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {exercise.sets.map((set) => (
                      <li key={set.id} className="flex justify-between tabular-nums">
                        <span className="text-text-muted">
                          {set.setNumber}. {labelOf(SET_TYPE_LABELS, set.setType)}
                        </span>
                        <span>
                          {set.loadKg != null ? formatWeight(set.loadKg) : '—'} × {set.reps ?? '—'}
                          {set.rir != null ? ` · RIR ${set.rir}` : ''}
                          {set.estimated1rm ? ` · 1RM ${formatWeight(set.estimated1rm)}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
