import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ExerciseDto } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounced } from '@/hooks/use-debounced';
import { EQUIPMENT_LABELS, MOVEMENT_PATTERN_LABELS, MUSCLE_LABELS, labelOf } from '@/lib/labels';
import { problemMessage } from '@/lib/problem';
import { ExerciseFormPanel } from './exercise-form-panel';
import { listExercises } from './exercises-api';

const SCOPES = [
  { value: 'all', label: 'Todos' },
  { value: 'global', label: 'Da plataforma' },
  { value: 'custom', label: 'Meus' },
] as const;

export function ExerciseLibraryPage() {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [scope, setScope] = useState<'all' | 'global' | 'custom'>('all');
  const [editing, setEditing] = useState<ExerciseDto | 'new' | null>(null);
  const debounced = useDebounced(search, 300);

  const query = useQuery({
    queryKey: ['exercises', { q: debounced, muscle, equipment, scope }],
    queryFn: () =>
      listExercises({
        q: debounced || undefined,
        muscle: muscle || undefined,
        equipment: equipment || undefined,
        scope,
        limit: 50,
      }),
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Biblioteca</h1>
        <Button onClick={() => setEditing(editing ? null : 'new')}>
          {editing ? 'Fechar' : 'Novo exercício'}
        </Button>
      </header>

      {editing ? (
        <ExerciseFormPanel
          exercise={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar exercício"
          aria-label="Buscar exercício"
          className="min-w-56 flex-1"
          type="search"
        />
        <select
          value={muscle}
          onChange={(event) => setMuscle(event.target.value)}
          aria-label="Filtrar por músculo"
          className="min-h-touch rounded-lg border border-border bg-surface-sunken px-3 text-sm text-text"
        >
          <option value="">Músculo</option>
          {Object.entries(MUSCLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={equipment}
          onChange={(event) => setEquipment(event.target.value)}
          aria-label="Filtrar por equipamento"
          className="min-h-touch rounded-lg border border-border bg-surface-sunken px-3 text-sm text-text"
        >
          <option value="">Equipamento</option>
          {Object.entries(EQUIPMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          {SCOPES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={scope === option.value}
              onClick={() => setScope(option.value)}
              className={`min-h-touch rounded-lg border px-3 text-sm ${
                scope === option.value
                  ? 'border-accent bg-accent/10 text-text'
                  : 'border-border bg-surface-raised text-text-muted'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {query.isPending ? (
        <Skeleton className="h-64" />
      ) : query.isError ? (
        <Alert variant="error">{problemMessage(query.error)}</Alert>
      ) : query.data.items.length === 0 ? (
        <Card>
          <CardContent>
            <CardDescription>Nenhum exercício com esses critérios.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.items.map((exercise) => (
            <li key={exercise.id}>
              <Card>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold">{exercise.name}</h2>
                    {exercise.tenantId ? (
                      <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">
                        seu
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-text-subtle">
                    {labelOf(EQUIPMENT_LABELS, exercise.equipment)} ·{' '}
                    {labelOf(MOVEMENT_PATTERN_LABELS, exercise.movementPattern)}
                  </p>
                  <p className="text-xs text-text-muted">
                    {exercise.muscles
                      .filter((muscleEntry) => muscleEntry.role === 'PRIMARY')
                      .map((muscleEntry) => labelOf(MUSCLE_LABELS, muscleEntry.muscle))
                      .join(', ')}
                  </p>
                  {exercise.tenantId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(exercise)}
                      className="self-start"
                    >
                      Editar
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
