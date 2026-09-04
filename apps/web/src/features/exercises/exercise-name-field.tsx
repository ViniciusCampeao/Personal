import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ExerciseDto } from '@pt/shared';
import { useToast } from '@/components/ui/use-toast';
import { problemMessage } from '@/lib/problem';
import { renameExercise } from './exercises-api';

interface ExerciseNameFieldProps {
  exercise: ExerciseDto;
}

/**
 * The trainer's one-field rename: a pencil next to the name, visible only here (this
 * page is trainer-only). Deliberately separate from `ExerciseFormPanel` — renaming a
 * global exercise doesn't touch equipment/muscles/etc., just how it reads in this
 * tenant's library.
 */
export function ExerciseNameField({ exercise }: ExerciseNameFieldProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(exercise.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const rename = useMutation({
    mutationFn: (value: string) => renameExercise(exercise.id, value),
    meta: { silent: true },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
      setEditing(false);
    },
    onError: (error) => {
      toast(problemMessage(error), 'error');
      setName(exercise.name);
    },
  });

  function save() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed === exercise.name) {
      setName(exercise.name);
      setEditing(false);
      return;
    }
    rename.mutate(trimmed);
  }

  // Focus moves here because the trainer just clicked "renomear" and this input replaced
  // the label they clicked — an effect rather than `autoFocus`, which the a11y rule bans
  // for the page-load case it cannot tell apart from this one.
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (editing) {
    return (
      <form
        className="flex min-w-0 flex-1 items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <input
          ref={inputRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setName(exercise.name);
              setEditing(false);
            }
          }}
          disabled={rename.isPending}
          aria-label="Nome do exercício"
          className="h-8 min-w-0 flex-1 rounded-md border border-accent bg-surface-sunken px-2 text-sm font-semibold text-text"
        />
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group flex min-w-0 flex-1 items-center gap-1.5 text-left"
    >
      <h2 className="truncate text-sm font-semibold">{exercise.name}</h2>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-3.5 shrink-0 text-text-subtle opacity-50 group-hover:opacity-100 group-focus-visible:opacity-100"
        fill="currentColor"
      >
        <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83ZM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z" />
      </svg>
      <span className="sr-only">Editar nome</span>
    </button>
  );
}
