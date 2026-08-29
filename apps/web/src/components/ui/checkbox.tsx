import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Rendered next to the box; may hold links (the LGPD consents link to the legal texts). */
  children: ReactNode;
  error?: string;
}

/**
 * Native checkbox, styled. No Radix — the browser control already gives keyboard,
 * indeterminate state and form participation for free.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, children, error, ...props },
  ref,
) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'mt-0.5 size-5 shrink-0 rounded border-border bg-surface-sunken text-accent',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            'aria-invalid:border-danger',
            className,
          )}
          {...props}
        />
        <label htmlFor={id} className="text-sm leading-5 text-text-muted">
          {children}
        </label>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
});
