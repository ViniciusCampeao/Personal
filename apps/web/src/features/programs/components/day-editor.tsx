import { useEffect, useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ExerciseDto, WorkoutDayDto } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { problemMessage } from '@/lib/problem';
import {
  dayToEditor,
  editorToPayload,
  groupWithPrevious,
  newExercise,
  ungroup,
  type EditorExercise,
} from '../editor-model';
import { replaceDayExercises } from '../programs-api';
import { ExercisePicker } from './exercise-picker';
import { ExerciseRow } from './exercise-row';

interface DayEditorProps {
  programId: string;
  day: WorkoutDayDto;
}

export function DayEditor({ programId, day }: DayEditorProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [exercises, setExercises] = useState<EditorExercise[]>(() => dayToEditor(day));
  const [dirty, setDirty] = useState(false);
  const [picking, setPicking] = useState(false);

  // Switching days (or reloading the program) resets the working copy. Unsaved edits are
  // guarded by the banner below, not by silently keeping stale rows around.
  useEffect(() => {
    setExercises(dayToEditor(day));
    setDirty(false);
  }, [day]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const save = useMutation({
    mutationFn: () => replaceDayExercises(day.id, editorToPayload(exercises)),
    meta: { silent: true },
    onSuccess: async () => {
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: ['programs', programId] });
      toast('Dia salvo.', 'success');
    },
  });

  function update(next: EditorExercise[]) {
    setExercises(next);
    setDirty(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = exercises.findIndex((exercise) => exercise.key === active.id);
    const to = exercises.findIndex((exercise) => exercise.key === over.id);
    if (from < 0 || to < 0) return;
    update(arrayMove(exercises, from, to));
  }

  function handlePick(exercise: ExerciseDto) {
    update([...exercises, newExercise(exercise.id, exercise.name)]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">
          {day.label}
          {day.name ? ` — ${day.name}` : ''}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setPicking((open) => !open)}>
            {picking ? 'Fechar busca' : 'Adicionar exercício'}
          </Button>
          <Button loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
            {dirty ? 'Salvar dia' : 'Salvo'}
          </Button>
        </div>
      </div>

      {picking ? <ExercisePicker onPick={handlePick} onClose={() => setPicking(false)} /> : null}

      {save.isError ? <Alert variant="error">{problemMessage(save.error)}</Alert> : null}

      {exercises.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-text-muted">
          Nenhum exercício neste dia ainda.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={exercises.map((exercise) => exercise.key)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-3">
              {exercises.map((exercise, index) => (
                <ExerciseRow
                  key={exercise.key}
                  exercise={exercise}
                  index={index}
                  groupPosition={groupPositionOf(exercises, index)}
                  onChange={(next) =>
                    update(exercises.map((item, i) => (i === index ? next : item)))
                  }
                  onRemove={() => update(exercises.filter((_, i) => i !== index))}
                  onGroup={() => update(groupWithPrevious(exercises, index))}
                  onUngroup={() => update(ungroup(exercises, index))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {dirty ? (
        <p className="text-sm text-warning" role="status">
          Alterações não salvas neste dia.
        </p>
      ) : null}
    </div>
  );
}

function groupPositionOf(exercises: EditorExercise[], index: number): 'none' | 'start' | 'middle' {
  const exercise = exercises[index];
  if (!exercise?.groupKey) return 'none';
  return exercises[index - 1]?.groupKey === exercise.groupKey ? 'middle' : 'start';
}
