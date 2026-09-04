import { cn } from '@/lib/cn';

/**
 * The one selected-vs-unselected treatment for the app's chip rows: scope filters, range
 * pickers, muscle toggles, the day strip in the program editor.
 *
 * Nine screens had each written their own version of this, and they had already drifted —
 * some tinted the label, some didn't, the selected border was a different weight in two of
 * them. Selection is carried by three things at once (border, tint, weight) because a tint
 * alone is nearly invisible on a ground this dark.
 *
 * Callers still own layout (`flex-1`, widths, wrapping) via `className`.
 */
export function segmentedClass(active: boolean, className?: string): string {
  return cn(
    'min-h-touch rounded-field border px-3 text-sm transition-colors',
    active
      ? 'border-accent/60 bg-accent/10 font-medium text-accent'
      : 'border-border bg-surface-raised text-text-muted hover:border-border-strong hover:text-text',
    className,
  );
}
