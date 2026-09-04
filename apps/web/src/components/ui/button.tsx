import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

/**
 * `size` is deliberate, not cosmetic: `md` is the 48px floor from spec §12, and `xl` is
 * the full-width 56px "concluir série" button of the execution screen (§8). Defined here
 * so that screen doesn't grow a one-off button of its own.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-field font-medium ' +
    'transition-[background-color,border-color,color,filter] duration-150 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Hover *brightens* rather than fading to the ground: a translucent fill would let
        // the card behind it show through and muddy the lime.
        primary: 'bg-accent-strong text-accent-fg hover:bg-accent active:brightness-95',
        secondary:
          'bg-surface-raised text-text border border-border hover:border-border-strong ' +
          'hover:bg-white/[0.04] active:bg-white/[0.02]',
        ghost: 'text-text-muted hover:bg-white/[0.05] hover:text-text active:bg-white/[0.02]',
        danger: 'bg-danger text-danger-fg hover:brightness-110 active:brightness-95',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'min-h-touch px-4 text-sm',
        lg: 'min-h-touch px-6 text-base',
        xl: 'h-touch-lg w-full px-6 text-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      aria-busy={loading || undefined}
      disabled={disabled ?? loading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});
