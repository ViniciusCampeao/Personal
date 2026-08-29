import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { TECHNIQUE_LABELS, labelOf } from '@/lib/labels';
import { summarizeEditorSets } from '../summarize';
import type { EditorExercise } from '../editor-model';
import { SetGrid } from './set-grid';

const TECHNIQUES = [
  'NORMAL',
  'BISET',
  'TRISET',
  'CIRCUIT',
  'DROPSET',
  'REST_PAUSE',
  'CLUSTER',
  'AMRAP',
  'PYRAMID',
  'ISOMETRIC',
] as const;

interface ExerciseRowProps {
  exercise: EditorExercise;
  index: number;
  groupPosition: 'none' | 'start' | 'middle';
  onChange: (exercise: EditorExercise) => void;
  onRemove: () => void;
  onGroup: () => void;
  onUngroup: () => void;
}

export function ExerciseRow({
  exercise,
  index,
  groupPosition,
  onChange,
  onRemove,
  onGroup,
  onUngroup,
}: ExerciseRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.key,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-card border bg-surface-raised ${
        isDragging ? 'border-accent opacity-80' : 'border-border'
      } ${groupPosition !== 'none' ? 'border-l-4 border-l-accent' : ''}`}
    >
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          // Keyboard users get the same reordering through dnd-kit's keyboard sensor.
          aria-label={`Reordenar ${exercise.exerciseName}`}
          className="mt-1 size-8 cursor-grab rounded text-text-subtle"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">
                {index + 1}. {exercise.exerciseName}
              </span>
              <span className="text-xs text-text-subtle">
                {summarizeEditorSets(exercise.sets)}
                {exercise.technique !== 'NORMAL'
                  ? ` · ${labelOf(TECHNIQUE_LABELS, exercise.technique)}`
                  : ''}
                {groupPosition !== 'none' ? ' · em bloco' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setExpanded((open) => !open)}>
                {expanded ? 'Recolher' : 'Detalhes'}
              </Button>
              {groupPosition === 'none' ? (
                <Button variant="ghost" size="sm" disabled={index === 0} onClick={onGroup}>
                  Agrupar
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={onUngroup}>
                  Desagrupar
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onRemove}>
                Remover
              </Button>
            </div>
          </div>

          <SetGrid sets={exercise.sets} onChange={(sets) => onChange({ ...exercise, sets })} />

          {expanded ? (
            <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-subtle">Técnica</span>
                <select
                  value={exercise.technique}
                  onChange={(event) => onChange({ ...exercise, technique: event.target.value })}
                  className="h-10 rounded-lg border border-border bg-surface-sunken px-2 text-sm text-text"
                >
                  {TECHNIQUES.map((technique) => (
                    <option key={technique} value={technique}>
                      {TECHNIQUE_LABELS[technique]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-subtle">Descanso (s)</span>
                <input
                  value={exercise.restSeconds}
                  onChange={(event) => onChange({ ...exercise, restSeconds: event.target.value })}
                  inputMode="numeric"
                  className="h-10 rounded-lg border border-border bg-surface-sunken px-2 text-sm text-text"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-text-subtle">Cadência</span>
                <input
                  value={exercise.tempo}
                  onChange={(event) => onChange({ ...exercise, tempo: event.target.value })}
                  placeholder="3-1-1-0"
                  className="h-10 rounded-lg border border-border bg-surface-sunken px-2 text-sm text-text"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm sm:col-span-3">
                <span className="text-xs text-text-subtle">Observações para o aluno</span>
                <textarea
                  value={exercise.notes}
                  onChange={(event) => onChange({ ...exercise, notes: event.target.value })}
                  rows={2}
                  className="rounded-lg border border-border bg-surface-sunken p-2 text-sm text-text"
                />
              </label>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
