import { db } from '@/lib/db';

/**
 * Every suite starts from an empty database: the Dexie connection is module state and
 * outlives a single test. IndexedDB itself comes from `fake-indexeddb`, installed in
 * `jest.setup.ts` — it must be in place before Dexie loads.
 */
export async function resetLocalDb(): Promise<void> {
  if (!db.isOpen()) await db.open();
  await db.transaction('rw', db.sessions, db.sets, db.outbox, db.cache, async () => {
    await Promise.all([db.sessions.clear(), db.sets.clear(), db.outbox.clear(), db.cache.clear()]);
  });
}
