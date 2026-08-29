import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface FinishPanelProps {
  pendingSets: number;
  onCancel: () => void;
  onConfirm: (input: {
    perceivedEffort: number | null;
    mood: number | null;
    notes: string | null;
  }) => void;
}

const MOODS = ['😞', '😕', '😐', '🙂', '😄'];

/** Closing questions (spec §8): how hard it felt, how the student felt, free notes. */
export function FinishPanel({ pendingSets, onCancel, onConfirm }: FinishPanelProps) {
  const [effort, setEffort] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  return (
    <section className="flex flex-col gap-5" aria-label="Finalizar treino">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Finalizar treino</h2>
        {pendingSets > 0 ? (
          <p className="text-sm text-warning">
            {pendingSets === 1
              ? 'Ainda falta 1 série prescrita.'
              : `Ainda faltam ${pendingSets} séries prescritas.`}{' '}
            Você pode finalizar mesmo assim.
          </p>
        ) : null}
      </header>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Esforço percebido</legend>
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={effort === value}
              onClick={() => setEffort(value)}
              className={cn(
                'min-h-touch rounded-lg border text-sm font-semibold',
                effort === value
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-border bg-surface-sunken text-text-muted',
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Como você se sentiu</legend>
        <div className="flex gap-2">
          {MOODS.map((emoji, index) => {
            const value = index + 1;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={mood === value}
                aria-label={`Humor ${value} de 5`}
                onClick={() => setMood(value)}
                className={cn(
                  'size-touch flex-1 rounded-lg border text-xl',
                  mood === value ? 'border-accent bg-accent/15' : 'border-border bg-surface-sunken',
                )}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Observações (opcional)</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className="rounded-lg border border-border bg-surface-sunken p-3 text-base text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
        />
      </label>

      <div className="flex flex-col gap-2">
        <Button
          size="xl"
          onClick={() => onConfirm({ perceivedEffort: effort, mood, notes: notes.trim() || null })}
        >
          Concluir treino
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Voltar ao treino
        </Button>
      </div>
    </section>
  );
}
