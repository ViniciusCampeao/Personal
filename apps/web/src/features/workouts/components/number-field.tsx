import { useId } from 'react';
import { cn } from '@/lib/cn';

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: number;
  min?: number;
  unit?: string;
  className?: string;
}

/**
 * Weight/reps entry for a sweaty hand mid-set: a wide numeric input flanked by two
 * ≥48px steppers, so the common adjustment ("same as last time, plus 2.5 kg") never
 * requires the on-screen keyboard at all.
 */
export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  unit,
  className,
}: NumberFieldProps) {
  const id = useId();
  const numeric = Number(value.replace(',', '.'));
  const current = Number.isFinite(numeric) ? numeric : 0;

  const nudge = (delta: number) => {
    const next = Math.max(min, Math.round((current + delta) * 100) / 100);
    onChange(String(next));
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-text-subtle">
        {label}
      </label>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => nudge(-step)}
          aria-label={`Diminuir ${label}`}
          className="size-touch shrink-0 rounded-field border border-border bg-surface-sunken text-xl leading-none text-text-muted active:bg-surface-raised"
        >
          −
        </button>
        <div className="relative flex min-w-0 flex-1">
          <input
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            // A numeric keypad on iOS needs `decimal`; `type="number"` also brings
            // scroll-wheel changes and a spinner that fight the steppers beside it.
            inputMode="decimal"
            className="min-h-touch w-full rounded-field border border-border bg-surface-sunken px-3 text-center text-lg font-semibold text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
          />
          {unit ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-subtle"
            >
              {unit}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => nudge(step)}
          aria-label={`Aumentar ${label}`}
          className="size-touch shrink-0 rounded-field border border-border bg-surface-sunken text-xl leading-none text-text-muted active:bg-surface-raised"
        >
          +
        </button>
      </div>
    </div>
  );
}
