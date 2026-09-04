import { useEffect, useRef, useState } from 'react';
import { useSyncStatus } from '@/features/sync/use-sync';

/**
 * How long the "everything landed" confirmation stays up. Without it the badge would
 * simply vanish, and a disappearance is ambiguous — it reads the same as a component that
 * never rendered. The student needs one beat of positive confirmation that the queue
 * emptied, then the header goes quiet again.
 */
const SETTLED_MS = 3_000;

/**
 * Spec §9 asks the header to say how much is still queued. Silence means "everything is
 * on the server" — the badge only appears when that stops being true, or for a moment
 * after it becomes true again.
 */
export function SyncIndicator() {
  const { online, pending, failed, syncing } = useSyncStatus();
  const settled = useJustSettled(pending, online);

  if (online && pending === 0 && failed === 0) {
    return settled ? <Badge tone="bg-success/15 text-success">Sincronizado</Badge> : null;
  }

  return (
    <Badge tone={failed > 0 ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'}>
      {describe({ online, pending, failed, syncing })}
    </Badge>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      // Connectivity changes on its own, so announce it politely rather than as an alert.
      aria-live="polite"
      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${tone}`}
    >
      {children}
    </span>
  );
}

/**
 * True for a few seconds after the queue drains from non-empty to empty while online.
 * Deliberately not triggered on mount: arriving at a screen with nothing queued is not an
 * event, and flashing a confirmation for work the student never saw pending is a lie.
 */
function useJustSettled(pending: number, online: boolean): boolean {
  const previous = useRef(pending);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const drained = previous.current > 0 && pending === 0 && online;
    previous.current = pending;
    if (!drained) return;

    setSettled(true);
    const timer = window.setTimeout(() => setSettled(false), SETTLED_MS);
    return () => window.clearTimeout(timer);
  }, [pending, online]);

  return settled;
}

function describe({
  online,
  pending,
  failed,
  syncing,
}: {
  online: boolean;
  pending: number;
  failed: number;
  syncing: boolean;
}): string {
  if (failed > 0) return `${failed} ${plural(failed)} com erro`;
  if (!online) return pending > 0 ? `Offline · ${pending} ${plural(pending)}` : 'Sem conexão';
  if (syncing) return 'Sincronizando…';
  return `${pending} ${plural(pending)}`;
}

function plural(count: number): string {
  return count === 1 ? 'registro pendente' : 'registros pendentes';
}
