import type { PrescribedExerciseInput, PrescribedSetDto, WorkoutDayDto } from '@pt/shared';
import { newUuid } from '@/lib/uuid';

/**
 * The editor's working copy of a day.
 *
 * `PUT /days/:id/exercises` replaces the whole list, so the editor holds the entire day
 * in memory, lets the trainer rearrange it freely, and sends one payload on save. Rows
 * carry a local `key` because a newly added exercise has no server id yet and React
 * still needs a stable identity for it.
 */
export interface EditorSet {
  key: string;
  setType: PrescribedSetDto['setType'];
  repsMin: string;
  repsMax: string;
  targetLoadKg: string;
  targetRir: string;
  restSecondsOverride: string;
}

export interface EditorExercise {
  key: string;
  exerciseId: string;
  exerciseName: string;
  technique: string;
  restSeconds: string;
  tempo: string;
  notes: string;
  /** Shared by every exercise in the same bi-set/tri-set block. */
  groupKey: string | null;
  sets: EditorSet[];
}

export function emptySet(previous?: EditorSet): EditorSet {
  return {
    key: newUuid(),
    setType: previous?.setType ?? 'WORK',
    repsMin: previous?.repsMin ?? '',
    repsMax: previous?.repsMax ?? '',
    targetLoadKg: previous?.targetLoadKg ?? '',
    targetRir: previous?.targetRir ?? '',
    restSecondsOverride: previous?.restSecondsOverride ?? '',
  };
}

export function newExercise(exerciseId: string, exerciseName: string): EditorExercise {
  return {
    key: newUuid(),
    exerciseId,
    exerciseName,
    technique: 'NORMAL',
    restSeconds: '',
    tempo: '',
    notes: '',
    groupKey: null,
    // A prescription with no sets is rejected by the API, so a new row starts with one.
    sets: [emptySet()],
  };
}

export function dayToEditor(day: WorkoutDayDto): EditorExercise[] {
  return [...day.exercises]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((exercise) => ({
      key: exercise.id,
      exerciseId: exercise.exercise.id,
      exerciseName: exercise.exercise.name,
      technique: exercise.technique,
      restSeconds: exercise.restSeconds != null ? String(exercise.restSeconds) : '',
      tempo: exercise.tempo ?? '',
      notes: exercise.notes ?? '',
      groupKey: exercise.groupKey,
      sets: [...exercise.sets]
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((set) => ({
          key: set.id,
          setType: set.setType,
          repsMin: set.repsMin != null ? String(set.repsMin) : '',
          repsMax: set.repsMax != null ? String(set.repsMax) : '',
          targetLoadKg: set.targetLoadKg != null ? String(set.targetLoadKg) : '',
          targetRir: set.targetRir != null ? String(set.targetRir) : '',
          restSecondsOverride:
            set.restSecondsOverride != null ? String(set.restSecondsOverride) : '',
        })),
    }));
}

function num(value: string): number | undefined {
  const parsed = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(parsed) ? parsed : undefined;
}

/** Turns the working copy into the API payload, dropping every blank optional field. */
export function editorToPayload(exercises: EditorExercise[]): PrescribedExerciseInput[] {
  return exercises.map((exercise, index) => {
    const groupOrder = exercise.groupKey
      ? exercises.filter((other, i) => i < index && other.groupKey === exercise.groupKey).length
      : undefined;

    return {
      exerciseId: exercise.exerciseId,
      orderIndex: index,
      technique: exercise.technique as PrescribedExerciseInput['technique'],
      ...(exercise.groupKey ? { groupKey: exercise.groupKey, groupOrder } : {}),
      ...(num(exercise.restSeconds) != null ? { restSeconds: num(exercise.restSeconds) } : {}),
      ...(exercise.tempo.trim() ? { tempo: exercise.tempo.trim() } : {}),
      ...(exercise.notes.trim() ? { notes: exercise.notes.trim() } : {}),
      sets: exercise.sets.map((set, setIndex) => ({
        setNumber: setIndex + 1,
        setType: set.setType,
        ...(num(set.repsMin) != null ? { repsMin: num(set.repsMin) } : {}),
        ...(num(set.repsMax) != null ? { repsMax: num(set.repsMax) } : {}),
        ...(num(set.targetLoadKg) != null ? { targetLoadKg: num(set.targetLoadKg) } : {}),
        ...(num(set.targetRir) != null ? { targetRir: num(set.targetRir) } : {}),
        ...(num(set.restSecondsOverride) != null
          ? { restSecondsOverride: num(set.restSecondsOverride) }
          : {}),
      })),
    } as PrescribedExerciseInput;
  });
}

/** Groups an exercise with the one above it, creating the shared key if needed. */
export function groupWithPrevious(exercises: EditorExercise[], index: number): EditorExercise[] {
  const previous = exercises[index - 1];
  if (!previous) return exercises;

  const groupKey = previous.groupKey ?? newUuid();
  return exercises.map((exercise, i) => {
    if (i === index - 1) return { ...exercise, groupKey };
    if (i === index) return { ...exercise, groupKey };
    return exercise;
  });
}

/** Removes an exercise from its block; a block left with one member is dissolved. */
export function ungroup(exercises: EditorExercise[], index: number): EditorExercise[] {
  const target = exercises[index];
  if (!target?.groupKey) return exercises;

  const groupKey = target.groupKey;
  const next = exercises.map((exercise, i) =>
    i === index ? { ...exercise, groupKey: null } : exercise,
  );
  const remaining = next.filter((exercise) => exercise.groupKey === groupKey);
  if (remaining.length > 1) return next;
  return next.map((exercise) =>
    exercise.groupKey === groupKey ? { ...exercise, groupKey: null } : exercise,
  );
}
