import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ExerciseDto } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EQUIPMENT_LABELS, labelOf } from '@/lib/labels';
import { problemMessage } from '@/lib/problem';
import { fetchSubstitutes, listExercises } from '@/features/exercises/exercises-api';

interface SubstitutePanelProps {
  exerciseId: string;
  exerciseName: string;
  onCancel: () => void;
  onConfirm: (replacement: ExerciseDto, reason: string | null) => void;
}

/**
 * Inline panel rather than a modal: it is used one-handed, mid-workout, and a dialog on
 * a phone means a focus trap over a screen that is already full-width.
 */
export function SubstitutePanel({
  exerciseId,
  exerciseName,
  onCancel,
  onConfirm,
}: SubstitutePanelProps) {
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');

  const suggestions = useQuery({
    queryKey: ['exercises', exerciseId, 'substitutes'],
    queryFn: () => fetchSubstitutes(exerciseId),
    staleTime: 10 * 60_000,
  });

  const searched = useQuery({
    queryKey: ['exercises', 'search', search],
    queryFn: () => listExercises({ q: search, limit: 20 }),
    enabled: search.trim().length >= 2,
  });

  const options: ExerciseDto[] =
    search.trim().length >= 2 ? (searched.data?.items ?? []) : (suggestions.data ?? []);
  const error = suggestions.error ?? searched.error;
  const loading = search.trim().length >= 2 ? searched.isPending : suggestions.isPending;

  return (
    <section className="flex flex-col gap-4" aria-label="Substituir exercício">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Substituir {exerciseName}</h2>
        <p className="text-sm text-text-muted">
          Escolha um exercício equivalente. Seu treinador vê a troca no histórico.
        </p>
      </header>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar exercício…"
        aria-label="Buscar exercício"
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Motivo (opcional)</span>
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Equipamento ocupado, dor no ombro…"
        />
      </label>

      {error ? <Alert variant="error">{problemMessage(error)}</Alert> : null}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => onConfirm(option, reason.trim() || null)}
                className="flex min-h-touch w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised px-4 py-2 text-left active:bg-surface-sunken"
              >
                <span className="font-medium">{option.name}</span>
                <span className="shrink-0 text-xs text-text-subtle">
                  {labelOf(EQUIPMENT_LABELS, option.equipment)}
                </span>
              </button>
            </li>
          ))}
          {options.length === 0 ? (
            <li className="text-sm text-text-muted">
              {search.trim().length >= 2
                ? 'Nenhum exercício encontrado.'
                : 'Sem equivalentes cadastrados — busque pelo nome.'}
            </li>
          ) : null}
        </ul>
      )}

      <Button variant="ghost" onClick={onCancel}>
        Cancelar
      </Button>
    </section>
  );
}
