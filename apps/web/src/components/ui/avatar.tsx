import { cn } from '@/lib/cn';

/**
 * Initials mark for list rows. Deliberately monochrome: a per-person hue would compete
 * with the accent and with the chart palette, and it would encode nothing. Its job is to
 * give a long list a scannable left edge, not to identify by colour.
 */
export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-border',
        'bg-surface-sunken font-medium uppercase text-text-muted',
        size === 'sm' ? 'size-7 text-[11px]' : 'size-9 text-xs',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/** First and last word, so "Bruno Lima" reads BL and a single name still yields a letter. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return first + last || '?';
}
