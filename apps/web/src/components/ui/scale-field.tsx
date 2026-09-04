import { cn } from '@/lib/cn';

interface ScaleFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  /** Ends of the scale, so "3" is never ambiguous. */
  lowLabel: string;
  highLabel: string;
  max?: number;
}

/**
 * A 1–5 answer as a row of buttons rather than a range input: on a phone a slider is
 * hard to land precisely, and a radio group announces the chosen value to a screen
 * reader without any custom ARIA.
 */
export function ScaleField({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
  max = 5,
}: ScaleFieldProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {Array.from({ length: max }, (_, index) => index + 1).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={cn(
              'min-h-touch flex-1 rounded-field border text-base font-semibold',
              value === option
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-border bg-surface-sunken text-text-muted',
            )}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-text-subtle">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </fieldset>
  );
}
