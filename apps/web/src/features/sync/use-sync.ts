import { useEffect, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { failedCount, pendingCount } from './outbox';
import { getSyncState, startSyncLoop, subscribeToSync, type SyncState } from './sync-engine';

export interface SyncStatus extends SyncState {
  online: boolean;
  /** Writes still waiting to reach the server. */
  pending: number;
  /** Writes the server kept rejecting; these need the user to be told. */
  failed: number;
}

export function useSyncStatus(): SyncStatus {
  const online = useOnlineStatus();
  const engine = useSyncExternalStore(subscribeToSync, getSyncState, getSyncState);
  const pending = useLiveQuery(pendingCount, [], 0);
  const failed = useLiveQuery(failedCount, [], 0);

  return { ...engine, online, pending, failed };
}

/** Runs the background drain for as long as a student is signed in. */
export function useSyncLoop(): void {
  useEffect(() => startSyncLoop(), []);
}
