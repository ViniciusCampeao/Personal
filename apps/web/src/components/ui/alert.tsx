import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const alertVariants = cva('rounded-lg border px-4 py-3 text-sm', {
  variants: {
    variant: {
      info: 'border-border-strong bg-surface-raised text-text-muted',
      warning: 'border-warning/40 bg-warning/10 text-warning',
      error: 'border-danger/40 bg-danger/10 text-danger',
    },
  },
  defaultVariants: { variant: 'info' },
});

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      // Errors are rendered in response to a user action, so they must be announced.
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}
