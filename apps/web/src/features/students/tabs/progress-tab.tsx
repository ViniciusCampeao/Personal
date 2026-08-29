import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatWeight } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { AdherenceChart } from '@/features/progress/components/adherence-chart';
import { ExerciseChart } from '@/features/progress/components/exercise-chart';
import { VolumeChart } from '@/features/progress/components/volume-chart';
import {
  fetchAdherence,
  fetchExerciseSeries,
  fetchRecords,
  fetchVolume,
} from '@/features/progress/progress-api';
import { apiFetch } from '@/lib/api';
import type { ProgressionSuggestionDto } from '@pt/shared';
import { useStudent } from './use-student';

export function StudentProgressTab() {
  const student = useStudent();
  const [weeks, setWeeks] = useState(12);

  const adherence = useQuery({
    queryKey: ['students', student.id, 'adherence', weeks],
    queryFn: () => fetchAdherence(student.id, weeks),
  });
  const volume = useQuery({
    queryKey: ['students', student.id, 'volume', weeks],
    queryFn: () => fetchVolume(student.id, weeks),
  });
  const records = useQuery({
    queryKey: ['students', student.id, 'records'],
    queryFn: () => fetchRecords(student.id),
  });
  const suggestions = useQuery({
    queryKey: ['students', student.id, 'progression-suggestions'],
    queryFn: () =>
      apiFetch<ProgressionSuggestionDto[]>(`/students/${student.id}/progression-suggestions`),
  });

  const options = [
    ...new Map((records.data ?? []).map((r) => [r.exerciseId, r.exerciseName])).entries(),
  ];
  const [selected, setSelected] = useState<string | null>(null);
  const exerciseId = selected ?? options[0]?.[0] ?? null;

  const series = useQuery({
    queryKey: ['students', student.id, 'exercise-series', exerciseId],
    enabled: Boolean(exerciseId),
    queryFn: () => fetchExerciseSeries(student.id, exerciseId!),
  });

  const error = adherence.error ?? volume.error ?? records.error;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        {[4, 12, 26].map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={weeks === option}
            onClick={() => setWeeks(option)}
            className={`min-h-touch rounded-lg border px-3 text-sm ${
              weeks === option
                ? 'border-accent bg-accent/10 text-text'
                : 'border-border bg-surface-raised text-text-muted'
            }`}
          >
            {option} semanas
          </button>
        ))}
      </div>

      {error ? <Alert variant="error">{problemMessage(error)}</Alert> : null}

      {suggestions.data && suggestions.data.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">Sugestões de progressão</h2>
            <CardDescription>
              Baseadas nas últimas séries registradas. Aplique no editor do programa.
            </CardDescription>
            <ul className="flex flex-col gap-1 text-sm">
              {suggestions.data.map((suggestion) => (
                <li key={suggestion.prescribedExerciseId} className="flex justify-between gap-3">
                  <span className="truncate">{suggestion.exerciseName}</span>
                  <span className="shrink-0 tabular-nums">
                    {formatWeight(suggestion.currentLoadKg)} →{' '}
                    <strong
                      className={
                        suggestion.direction === 'INCREASE'
                          ? 'text-success'
                          : suggestion.direction === 'DECREASE'
                            ? 'text-warning'
                            : 'text-text'
                      }
                    >
                      {formatWeight(suggestion.suggestedLoadKg)}
                    </strong>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {adherence.isPending ? (
        <Skeleton className="h-64" />
      ) : (adherence.data?.length ?? 0) > 0 ? (
        <AdherenceChart weeks={adherence.data!} />
      ) : null}

      {volume.isPending ? (
        <Skeleton className="h-64" />
      ) : (volume.data?.length ?? 0) > 0 ? (
        <VolumeChart rows={volume.data!} />
      ) : null}

      {options.length > 0 ? (
        <ExerciseChart
          exerciseName={options.find(([id]) => id === exerciseId)?.[1] ?? ''}
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
      ) : null}
    </div>
  );
}
