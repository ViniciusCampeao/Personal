import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatWeight } from '@/lib/format';
import { PR_TYPE_LABELS, labelOf } from '@/lib/labels';
import { problemMessage } from '@/lib/problem';
import { useAuth } from '@/features/auth/auth-context';
import { AdherenceChart } from './components/adherence-chart';
import { ExerciseChart } from './components/exercise-chart';
import { VolumeChart } from './components/volume-chart';
import { fetchAdherence, fetchExerciseSeries, fetchRecords, fetchVolume } from './progress-api';

const RANGES = [
  { weeks: 4, label: '4 semanas' },
  { weeks: 12, label: '12 semanas' },
  { weeks: 26, label: '26 semanas' },
] as const;

export function ProgressPage() {
  const { user } = useAuth();
  const studentId = user?.id;
  const [weeks, setWeeks] = useState<number>(12);

  const adherence = useQuery({
    queryKey: ['students', studentId, 'adherence', weeks],
    enabled: Boolean(studentId),
    queryFn: () => fetchAdherence(studentId!, weeks),
  });
  const volume = useQuery({
    queryKey: ['students', studentId, 'volume', weeks],
    enabled: Boolean(studentId),
    queryFn: () => fetchVolume(studentId!, weeks),
  });
  const records = useQuery({
    queryKey: ['students', studentId, 'records'],
    enabled: Boolean(studentId),
    queryFn: () => fetchRecords(studentId!),
  });

  const error = adherence.error ?? volume.error ?? records.error;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">Progresso</h1>
        {/* One row of filters above the charts — never inside a plot. */}
        <div className="flex gap-2">
          {RANGES.map((range) => (
            <button
              key={range.weeks}
              type="button"
              aria-pressed={weeks === range.weeks}
              onClick={() => setWeeks(range.weeks)}
              className={`min-h-touch flex-1 rounded-lg border px-3 text-sm ${
                weeks === range.weeks
                  ? 'border-accent bg-accent/10 text-text'
                  : 'border-border bg-surface-raised text-text-muted'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </header>

      {error ? <Alert variant="error">{problemMessage(error)}</Alert> : null}

      {adherence.isPending ? (
        <Skeleton className="h-64" />
      ) : (adherence.data?.length ?? 0) === 0 ? (
        <EmptyCard />
      ) : (
        <AdherenceChart weeks={adherence.data!} />
      )}

      {volume.isPending ? (
        <Skeleton className="h-64" />
      ) : (volume.data?.length ?? 0) > 0 ? (
        <VolumeChart rows={volume.data!} />
      ) : null}

      <ExerciseSection studentId={studentId} />

      <RecordsSection
        studentId={studentId}
        records={records.data ?? []}
        loading={records.isPending}
      />
    </div>
  );
}

function EmptyCard() {
  return (
    <Card>
      <CardContent>
        <CardDescription>
          Assim que você concluir alguns treinos, sua evolução aparece aqui.
        </CardDescription>
      </CardContent>
    </Card>
  );
}

/**
 * The exercise picker is fed by the student's own personal records: those are exactly
 * the movements they have actually trained, so the list can never offer an exercise with
 * an empty chart behind it.
 */
function ExerciseSection({ studentId }: { studentId: string | undefined }) {
  const records = useQuery({
    queryKey: ['students', studentId, 'records'],
    enabled: Boolean(studentId),
    queryFn: () => fetchRecords(studentId!),
  });

  const options = [
    ...new Map(
      (records.data ?? []).map((record) => [record.exerciseId, record.exerciseName]),
    ).entries(),
  ];
  const [selected, setSelected] = useState<string | null>(null);
  const exerciseId = selected ?? options[0]?.[0] ?? null;
  const exerciseName = options.find(([id]) => id === exerciseId)?.[1] ?? '';

  const series = useQuery({
    queryKey: ['students', studentId, 'exercise-series', exerciseId],
    enabled: Boolean(studentId && exerciseId),
    queryFn: () => fetchExerciseSeries(studentId!, exerciseId!),
  });

  if (records.isPending) return <Skeleton className="h-64" />;
  if (options.length === 0) return null;

  return (
    <ExerciseChart
      exerciseName={exerciseName}
      points={series.data ?? []}
      controls={
        <label className="flex w-full flex-col gap-1.5">
          <span className="text-xs text-text-subtle">Exercício</span>
          <select
            value={exerciseId ?? ''}
            onChange={(event) => setSelected(event.target.value)}
            className="min-h-touch rounded-lg border border-border bg-surface-sunken px-3 text-sm text-text"
          >
            {options.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      }
    />
  );
}

function RecordsSection({
  studentId,
  records,
  loading,
}: {
  studentId: string | undefined;
  records: { id: string; exerciseName: string; type: string; value: number; achievedAt: string }[];
  loading: boolean;
}) {
  if (!studentId) return null;
  if (loading) return <Skeleton className="h-32" />;
  if (records.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Seus recordes</h2>
      <ul className="flex flex-col gap-2">
        {records.slice(0, 10).map((record) => (
          <li
            key={record.id}
            className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-raised px-4 py-3"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{record.exerciseName}</span>
              <span className="text-xs text-text-subtle">
                {labelOf(PR_TYPE_LABELS, record.type)} · {formatDate(record.achievedAt)}
              </span>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {record.type === 'MAX_REPS' ? `${record.value} reps` : formatWeight(record.value)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
