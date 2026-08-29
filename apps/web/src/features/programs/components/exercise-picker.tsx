import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ExerciseDto } from '@pt/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, MOVEMENT_PATTERN_LABELS, labelOf } from '@/lib/labels';
import { useDebounced } from '@/hooks/use-debounced';
import { listExercises } from '@/features/exercises/exercises-api';

interface ExercisePickerProps {
  onPick: (exercise: ExerciseDto) => void;
  onClose: () => void;
}

/** Inline panel, not a modal: picking several exercises in a row is the normal case. */
export function ExercisePicker({ onPick, onClose }: ExercisePickerProps) {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('');
  const debounced = useDebounced(search, 300);

  const query = useQuery({
    queryKey: ['exercises', { q: debounced, muscle }],
    queryFn: () =>
      listExercises({ q: debounced || undefined, muscle: muscle || undefined, limit: 30 }),
  });

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Adicionar exercício</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar exercício"
          aria-label="Buscar exercício"
          className="min-w-48 flex-1"
          type="search"
        />
        <select
          value={muscle}
          onChange={(event) => setMuscle(event.target.value)}
          aria-label="Filtrar por músculo"
          className="min-h-touch rounded-lg border border-border bg-surface-sunken px-3 text-sm text-text"
        >
          <option value="">Todos os músculos</option>
          {Object.entries(MUSCLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {query.isPending ? (
        <Skeleton className="h-32" />
      ) : (
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {query.data?.items.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => onPick(exercise)}
                className="flex min-h-touch w-full items-center justify-between gap-3 rounded-lg px-3 text-left hover:bg-surface"
              >
                <span className="truncate text-sm font-medium">{exercise.name}</span>
                <span className="shrink-0 text-xs text-text-subtle">
                  {labelOf(EQUIPMENT_LABELS, exercise.equipment)} ·{' '}
                  {labelOf(MOVEMENT_PATTERN_LABELS, exercise.movementPattern)}
                </span>
              </button>
            </li>
          ))}
          {query.data?.items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-text-muted">Nenhum exercício encontrado.</li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
