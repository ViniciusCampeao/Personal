import { cn } from '@/lib/cn';

/**
 * A count with its label. The number is the hero — it leads, at display size, in tabular
 * figures — and the label is the caption under it. The previous order (small label first,
 * number second) made four tiles read as four sentences instead of four numbers.
 *
 * `tone` only *activates* when the value is non-zero: "0 alunos com pendência" is good news
 * and must not be painted as a warning.
 */
export function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'warning' | 'success';
}) {
  const active = value > 0 && tone !== 'neutral';

  return (
    <div
      className={cn(
        'rounded-card border bg-surface-raised p-4 shadow-card transition-colors',
        active && tone === 'warning' && 'border-warning/30',
        active && tone === 'success' && 'border-success/30',
        !active && 'border-border',
      )}
    >
      <div
        className={cn(
          'text-3xl font-semibold tabular-nums tracking-tight',
          active && tone === 'warning' && 'text-warning',
          active && tone === 'success' && 'text-success',
          !active && 'text-text',
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-text-muted">{label}</div>
    </div>
  );
}
