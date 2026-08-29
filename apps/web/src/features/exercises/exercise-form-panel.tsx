import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  equipments,
  loadTypes,
  movementPatterns,
  muscleGroups,
  type CreateExerciseInput,
  type ExerciseDto,
} from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { EQUIPMENT_LABELS, MOVEMENT_PATTERN_LABELS, MUSCLE_LABELS, labelOf } from '@/lib/labels';
import { problemMessage } from '@/lib/problem';
import { uploadFile } from '@/lib/upload';

const LOAD_TYPE_LABELS: Record<(typeof loadTypes)[number], string> = {
  EXTERNAL: 'Carga externa',
  BODYWEIGHT: 'Peso corporal',
  BODYWEIGHT_PLUS: 'Peso corporal + carga',
  TIME: 'Tempo',
  DISTANCE: 'Distância',
  NONE: 'Sem carga',
};

interface ExerciseFormPanelProps {
  exercise: ExerciseDto | null;
  onDone: () => void;
}

/** Custom exercises belong to the trainer's tenant; the global catalogue is read-only. */
export function ExerciseFormPanel({ exercise, onDone }: ExerciseFormPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState(exercise?.name ?? '');
  const [movementPattern, setPattern] = useState(exercise?.movementPattern ?? 'HORIZONTAL_PUSH');
  const [equipment, setEquipment] = useState(exercise?.equipment ?? 'BARBELL');
  const [loadType, setLoadType] = useState(exercise?.loadType ?? 'EXTERNAL');
  const [unilateral, setUnilateral] = useState(exercise?.unilateral ?? false);
  const [instructions, setInstructions] = useState(exercise?.instructions ?? '');
  const [primary, setPrimary] = useState<string[]>(
    exercise?.muscles.filter((m) => m.role === 'PRIMARY').map((m) => m.muscle) ?? [],
  );
  const [videoKey, setVideoKey] = useState(exercise?.videoUrl ?? '');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: (input: CreateExerciseInput) =>
      exercise
        ? apiFetch<ExerciseDto>(`/exercises/${exercise.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          })
        : apiFetch<ExerciseDto>('/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }),
    meta: { silent: true },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
      toast(exercise ? 'Exercício atualizado.' : 'Exercício criado.', 'success');
      onDone();
    },
  });

  async function handleVideo(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      setVideoKey(await uploadFile(file, 'exercise-video'));
    } catch (error) {
      setUploadError(problemMessage(error));
    } finally {
      setUploading(false);
    }
  }

  function toggleMuscle(muscle: string) {
    setPrimary((current) =>
      current.includes(muscle) ? current.filter((item) => item !== muscle) : [...current, muscle],
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-surface-raised p-4">
      <h2 className="text-base font-semibold">
        {exercise ? `Editar ${exercise.name}` : 'Novo exercício'}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          {(field) => (
            <Input {...field} value={name} onChange={(event) => setName(event.target.value)} />
          )}
        </Field>

        <Field label="Padrão de movimento">
          {(field) => (
            <select
              {...field}
              value={movementPattern}
              onChange={(event) => setPattern(event.target.value as typeof movementPattern)}
              className="min-h-touch rounded-lg border border-border bg-surface-sunken px-3 text-base text-text"
            >
              {movementPatterns.map((option) => (
                <option key={option} value={option}>
                  {labelOf(MOVEMENT_PATTERN_LABELS, option)}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Equipamento">
          {(field) => (
            <select
              {...field}
              value={equipment}
              onChange={(event) => setEquipment(event.target.value as typeof equipment)}
              className="min-h-touch rounded-lg border border-border bg-surface-sunken px-3 text-base text-text"
            >
              {equipments.map((option) => (
                <option key={option} value={option}>
                  {labelOf(EQUIPMENT_LABELS, option)}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Tipo de carga">
          {(field) => (
            <select
              {...field}
              value={loadType}
              onChange={(event) => setLoadType(event.target.value as typeof loadType)}
              className="min-h-touch rounded-lg border border-border bg-surface-sunken px-3 text-base text-text"
            >
              {loadTypes.map((option) => (
                <option key={option} value={option}>
                  {LOAD_TYPE_LABELS[option]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <Checkbox checked={unilateral} onChange={(event) => setUnilateral(event.target.checked)}>
        Exercício unilateral
      </Checkbox>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Músculos principais</legend>
        <div className="flex flex-wrap gap-2">
          {muscleGroups.map((muscle) => (
            <button
              key={muscle}
              type="button"
              aria-pressed={primary.includes(muscle)}
              onClick={() => toggleMuscle(muscle)}
              className={`min-h-touch rounded-lg border px-3 text-sm ${
                primary.includes(muscle)
                  ? 'border-accent bg-accent/10 text-text'
                  : 'border-border bg-surface-sunken text-text-muted'
              }`}
            >
              {labelOf(MUSCLE_LABELS, muscle)}
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Instruções">
        {(field) => (
          <textarea
            {...field}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            rows={3}
            className="rounded-lg border border-border bg-surface-sunken p-3 text-base text-text"
          />
        )}
      </Field>

      <Field
        label="Vídeo de demonstração"
        hint={videoKey ? 'Vídeo enviado.' : 'MP4, WebM ou MOV, até 200 MB.'}
      >
        {(field) => (
          <input
            {...field}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={(event) => void handleVideo(event.target.files?.[0])}
            className="text-sm text-text-muted file:mr-3 file:min-h-touch file:rounded-lg file:border file:border-border file:bg-surface-sunken file:px-4 file:text-sm file:text-text"
          />
        )}
      </Field>

      {uploadError ? <Alert variant="error">{uploadError}</Alert> : null}
      {save.isError ? <Alert variant="error">{problemMessage(save.error)}</Alert> : null}

      <div className="flex gap-2">
        <Button
          loading={save.isPending || uploading}
          disabled={name.trim().length < 2 || primary.length === 0}
          onClick={() =>
            save.mutate({
              name: name.trim(),
              movementPattern,
              equipment,
              loadType,
              unilateral,
              cues: [],
              commonMistakes: [],
              ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
              ...(videoKey ? { videoUrl: videoKey } : {}),
              muscles: primary.map((muscle) => ({
                muscle: muscle as CreateExerciseInput['muscles'][number]['muscle'],
                role: 'PRIMARY' as const,
              })),
            })
          }
        >
          Salvar
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </section>
  );
}
