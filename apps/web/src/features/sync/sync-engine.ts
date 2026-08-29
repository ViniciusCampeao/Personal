import type { SyncItemInput, SyncSessionsResponseDto } from '@pt/shared';
import { apiFetch } from '@/lib/api';
import { db, type OutboxItem } from '@/lib/db';
import { acknowledge, selectSendable } from './outbox';

/** The API caps a sync batch at 200 items (`syncSessionsSchema`). */
const MAX_BATCH = 200;
/** After this many server rejections an item is parked instead of retried forever. */
const MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export interface SyncState {
  syncing: boolean;
  /** Last transport-level failure, if the queue could not be delivered at all. */
  lastError: string | null;
  lastSyncedAt: string | null;
}

let state: SyncState = { syncing: false, lastError: null, lastSyncedAt: null };
const listeners = new Set<(state: SyncState) => void>();

export function getSyncState(): SyncState {
  return state;
}

export function subscribeToSync(listener: (state: SyncState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

/** Exponential backoff with jitter, so a queue that piles up doesn't retry in lockstep. */
export function backoffMs(attempts: number): number {
  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);
  return Math.round(exponential * (0.75 + Math.random() * 0.5));
}

function toSyncItem(item: OutboxItem): SyncItemInput {
  switch (item.type) {
    case 'START':
      return { type: 'START', payload: item.payload } as SyncItemInput;
    case 'FINISH':
      return {
        type: 'FINISH',
        sessionClientUuid: item.sessionClientUuid,
        payload: item.payload,
      } as SyncItemInput;
    default:
      return {
        type: item.type,
        sessionClientUuid: item.sessionClientUuid,
        prescribedExerciseId: item.prescribedExerciseId,
        payload: item.payload,
      } as SyncItemInput;
  }
}

export interface FlushResult {
  sent: number;
  accepted: number;
  rejected: number;
  /** True when the batch never reached the server (offline, 5xx, timeout). */
  transportFailed: boolean;
}

const IDLE: FlushResult = { sent: 0, accepted: 0, rejected: 0, transportFailed: false };

let inFlight: Promise<FlushResult> | null = null;

/**
 * Drains the outbox once. Single-flight: two concurrent flushes would send the same
 * items twice — harmless server-side thanks to `clientUuid`, but it would double the
 * traffic of a phone that just came back online.
 */
export function flushOutbox(): Promise<FlushResult> {
  inFlight ??= runFlush().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runFlush(): Promise<FlushResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return IDLE;

  const queued = await db.outbox.toArray();
  const batch = selectSendable(queued, Date.now(), MAX_BATCH);
  if (batch.length === 0) return IDLE;

  setState({ syncing: true });
  try {
    const response = await apiFetch<SyncSessionsResponseDto>('/sessions/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: batch.map(toSyncItem) }),
    });
    const result = await applyResults(batch, response);
    setState({ lastError: null, lastSyncedAt: new Date().toISOString() });
    return result;
  } catch (error) {
    // The batch never landed. Nothing is consumed and no attempt is burned — this is the
    // network's fault, not the payload's — but the items back off so a flapping
    // connection isn't hammered.
    await delayBatch(batch);
    setState({ lastError: error instanceof Error ? error.message : 'Falha ao sincronizar.' });
    return { sent: batch.length, accepted: 0, rejected: 0, transportFailed: true };
  } finally {
    setState({ syncing: false });
  }
}

async function applyResults(
  batch: OutboxItem[],
  response: SyncSessionsResponseDto,
): Promise<FlushResult> {
  const accepted: number[] = [];
  const rejected: OutboxItem[] = [];
  const startedSessions: { clientUuid: string; serverId: string }[] = [];

  for (const result of response.results) {
    const item = batch[result.index];
    if (!item) continue;
    if (result.status === 'OK') {
      accepted.push(item.id);
      if (item.type === 'START' && result.sessionId) {
        startedSessions.push({ clientUuid: item.sessionClientUuid, serverId: result.sessionId });
      }
    } else {
      rejected.push({ ...item, lastError: result.error ?? 'Erro desconhecido.' });
    }
  }

  await acknowledge(accepted);
  await Promise.all(
    startedSessions.map(({ clientUuid, serverId }) => db.sessions.update(clientUuid, { serverId })),
  );
  await Promise.all(
    rejected.map((item) => {
      const attempts = item.attempts + 1;
      return db.outbox.update(item.id, {
        attempts,
        lastError: item.lastError,
        retryAt: Date.now() + backoffMs(attempts),
        failed: attempts >= MAX_ATTEMPTS ? 1 : 0,
      });
    }),
  );

  return {
    sent: batch.length,
    accepted: accepted.length,
    rejected: rejected.length,
    transportFailed: false,
  };
}

function delayBatch(batch: OutboxItem[]): Promise<unknown> {
  const retryAt = Date.now() + backoffMs(0);
  return Promise.all(batch.map((item) => db.outbox.update(item.id, { retryAt })));
}

const POLL_INTERVAL_MS = 30_000;
let stopLoop: (() => void) | null = null;

/**
 * Starts the background drain. Every trigger is a moment when delivery just became
 * likely again: the network returned, the app came back to the foreground, or enough
 * time passed for a backoff to expire.
 */
export function startSyncLoop(): () => void {
  if (stopLoop) return stopLoop;

  const attempt = () => void flushOutbox().catch(() => undefined);
  const onVisible = () => {
    if (document.visibilityState === 'visible') attempt();
  };

  window.addEventListener('online', attempt);
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(attempt, POLL_INTERVAL_MS);
  attempt();

  stopLoop = () => {
    window.removeEventListener('online', attempt);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
    stopLoop = null;
  };
  return stopLoop;
}

/** Test seam: module state (in-flight flush, listeners, loop) outlives a single test. */
export function resetSyncEngine(): void {
  stopLoop?.();
  inFlight = null;
  listeners.clear();
  state = { syncing: false, lastError: null, lastSyncedAt: null };
}
