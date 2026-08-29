import { db, type OutboxItem, type OutboxItemType } from '@/lib/db';

export interface EnqueueInput {
  sessionClientUuid: string;
  type: OutboxItemType;
  prescribedExerciseId?: string;
  payload: Record<string, unknown>;
}

export async function enqueue(input: EnqueueInput): Promise<number> {
  return db.outbox.add({
    sessionClientUuid: input.sessionClientUuid,
    type: input.type,
    prescribedExerciseId: input.prescribedExerciseId ?? null,
    payload: input.payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    retryAt: 0,
    failed: 0,
    lastError: null,
  } as OutboxItem);
}

/**
 * Picks what may be sent right now.
 *
 * Items of one session form a chain — `LOG_SET` is meaningless before its `START` — so a
 * blocked item (backing off, or given up on) stops everything behind it *for that session
 * only*. Other sessions keep flowing; one stuck workout must not freeze the queue.
 */
export function selectSendable(items: OutboxItem[], now: number, limit: number): OutboxItem[] {
  const blocked = new Set<string>();
  const sendable: OutboxItem[] = [];

  for (const item of [...items].sort((a, b) => a.id - b.id)) {
    if (blocked.has(item.sessionClientUuid)) continue;
    if (item.failed === 1 || item.retryAt > now) {
      blocked.add(item.sessionClientUuid);
      continue;
    }
    if (sendable.length >= limit) break;
    sendable.push(item);
  }

  return sendable;
}

export function pendingCount(): Promise<number> {
  return db.outbox.where('failed').equals(0).count();
}

export function failedCount(): Promise<number> {
  return db.outbox.where('failed').equals(1).count();
}

/** Drops the items the server has accepted; anything else stays queued. */
export async function acknowledge(ids: number[]): Promise<void> {
  if (ids.length > 0) await db.outbox.bulkDelete(ids);
}
