import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'min-h-touch w-full rounded-lg border border-border bg-surface-sunken px-3 text-base',
          'text-text placeholder:text-text-subtle',
          'focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent',
          'aria-invalid:border-danger aria-invalid:focus-visible:outline-danger',
          'disabled:opacity-50 read-only:text-text-muted',
          className,
        )}
        {...props}
      />
    );
  },
);
