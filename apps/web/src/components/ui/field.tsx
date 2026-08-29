import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Label } from './label';

/** Props `Field` hands to the control so the label, hint and error stay wired to it. */
export interface FieldControlProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}

/**
 * Every form in the app goes through here, so the label/hint/error wiring is written
 * once: ids are generated, `aria-describedby` points at whichever of hint/error is
 * present, and the error is announced via `role="alert"`.
 */
export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-xs text-text-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
