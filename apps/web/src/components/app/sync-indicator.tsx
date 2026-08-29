import { useSyncStatus } from '@/features/sync/use-sync';

/**
 * Spec §9 asks the header to say how much is still queued. Silence means "everything is
 * on the server" — the badge only appears when that stops being true.
 */
export function SyncIndicator() {
  const { online, pending, failed, syncing } = useSyncStatus();

  if (online && pending === 0 && failed === 0) return null;

  const tone = failed > 0 ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning';
  const label = describe({ online, pending, failed, syncing });

  return (
    <span
      // Connectivity changes on its own, so announce it politely rather than as an alert.
      aria-live="polite"
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
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
