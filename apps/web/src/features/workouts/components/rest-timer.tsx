import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatDuration } from '@/lib/format';

interface RestTimerProps {
  /** Changes whenever a new set is logged, which is what (re)starts the countdown. */
  startedAt: number;
  seconds: number;
  onDismiss: () => void;
}

/**
 * Counts down the prescribed rest. Driven by wall-clock deltas rather than by counting
 * ticks: a phone that locks its screen mid-rest suspends timers, and the student would
 * come back to a clock that had barely moved.
 */
export function RestTimer({ startedAt, seconds, onDismiss }: RestTimerProps) {
  const [remaining, setRemaining] = useState(() => remainingFrom(startedAt, seconds));
  const dismissed = useRef(false);

  useEffect(() => {
    dismissed.current = false;
    setRemaining(remainingFrom(startedAt, seconds));
    const timer = window.setInterval(() => {
      setRemaining(remainingFrom(startedAt, seconds));
    }, 250);
    return () => window.clearInterval(timer);
  }, [startedAt, seconds]);

  const done = remaining <= 0;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-card border px-4 py-3 ${
        done ? 'border-success/40 bg-success/10' : 'border-border bg-surface-raised'
      }`}
    >
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-text-subtle">
          {done ? 'Descanso concluído' : 'Descanso'}
        </span>
        <span
          className="text-2xl font-semibold tabular-nums"
          // Announced only when it finishes; a per-second live region would be noise.
          aria-live={done ? 'polite' : 'off'}
        >
          {formatDuration(Math.max(0, remaining))}
        </span>
      </div>
      <Button variant="secondary" onClick={onDismiss}>
        {done ? 'Ok' : 'Pular'}
      </Button>
    </div>
  );
}

function remainingFrom(startedAt: number, seconds: number): number {
  return Math.ceil((startedAt + seconds * 1000 - Date.now()) / 1000);
}
