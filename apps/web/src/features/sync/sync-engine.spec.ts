import { db, type OutboxItem } from '@/lib/db';
import { json, mockFetch, problem, type FetchMock } from '@/test-utils/fetch-mock';
import { resetLocalDb } from '@/test-utils/indexeddb';
import { enqueue, pendingCount, selectSendable } from './outbox';
import { backoffMs, flushOutbox, resetSyncEngine } from './sync-engine';

const SESSION_A = '11111111-1111-4111-8111-111111111111';
const SESSION_B = '22222222-2222-4222-8222-222222222222';

function item(overrides: Partial<OutboxItem>): OutboxItem {
  return {
    id: 1,
    sessionClientUuid: SESSION_A,
    type: 'LOG_SET',
    prescribedExerciseId: null,
    payload: {},
    createdAt: '2026-08-29T10:00:00.000Z',
    attempts: 0,
    retryAt: 0,
    failed: 0,
    lastError: null,
    ...overrides,
  };
}

describe('selectSendable', () => {
  it('keeps a session in the order it was recorded', () => {
    const items = [
      item({ id: 3, type: 'FINISH' }),
      item({ id: 1, type: 'START' }),
      item({ id: 2 }),
    ];

    expect(selectSendable(items, 0, 10).map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('holds back everything behind an item that is still backing off', () => {
    // Sending the set before its session exists would just be rejected again.
    const items = [item({ id: 1, retryAt: 5_000 }), item({ id: 2 })];

    expect(selectSendable(items, 1_000, 10)).toHaveLength(0);
  });

  it('lets other workouts through while one is stuck', () => {
    const items = [
      item({ id: 1, failed: 1 }),
      item({ id: 2 }),
      item({ id: 3, sessionClientUuid: SESSION_B }),
    ];

    expect(selectSendable(items, 0, 10).map((i) => i.id)).toEqual([3]);
  });
});

describe('backoffMs', () => {
  it('grows with each attempt and stays inside the jitter window', () => {
    for (const attempts of [0, 1, 2, 3]) {
      const value = backoffMs(attempts);
      const exponential = 2_000 * 2 ** attempts;
      expect(value).toBeGreaterThanOrEqual(exponential * 0.75);
      expect(value).toBeLessThanOrEqual(exponential * 1.25);
    }
  });

  it('caps the wait so a long-offline device still retries', () => {
    expect(backoffMs(30)).toBeLessThanOrEqual(5 * 60_000 * 1.25);
  });
});

describe('flushOutbox', () => {
  let fetchMock: FetchMock;

  beforeEach(async () => {
    fetchMock = mockFetch();
    resetSyncEngine();
    await resetLocalDb();
    await db.sessions.add({
      clientUuid: SESSION_A,
      serverId: null,
      workoutDayId: '33333333-3333-4333-8333-333333333333',
      programId: null,
      dayLabel: 'A',
      status: 'IN_PROGRESS',
      startedAt: '2026-08-29T10:00:00.000Z',
      finishedAt: null,
      perceivedEffort: null,
      mood: null,
      notes: null,
      exercises: [],
    });
  });

  afterEach(() => {
    fetchMock.restore();
    resetSyncEngine();
  });

  async function queueStartAndSet() {
    await enqueue({
      sessionClientUuid: SESSION_A,
      type: 'START',
      payload: { clientUuid: SESSION_A, workoutDayId: 'day', startedAt: 'now' },
    });
    await enqueue({
      sessionClientUuid: SESSION_A,
      type: 'LOG_SET',
      prescribedExerciseId: 'pe-1',
      payload: { clientUuid: 'set-1', setNumber: 1, reps: 10, doneAt: 'now' },
    });
  }

  it('sends the queue as one batch and drops what the server accepted', async () => {
    await queueStartAndSet();
    fetchMock.on('POST', '/api/v1/sessions/sync', () =>
      json({
        results: [
          { index: 0, type: 'START', status: 'OK', sessionId: 'server-1' },
          { index: 1, type: 'LOG_SET', status: 'OK' },
        ],
      }),
    );

    await expect(flushOutbox()).resolves.toMatchObject({ sent: 2, accepted: 2 });

    expect(await pendingCount()).toBe(0);
    const body = JSON.parse(fetchMock.call(0).body ?? '{}');
    expect(body.items.map((i: { type: string }) => i.type)).toEqual(['START', 'LOG_SET']);
    // The session's server id only exists after START lands, and later screens need it.
    expect((await db.sessions.get(SESSION_A))?.serverId).toBe('server-1');
  });

  it('sends one batch even when several triggers fire at once', async () => {
    await queueStartAndSet();
    fetchMock.on(
      'POST',
      '/api/v1/sessions/sync',
      () =>
        new Promise<Response>((resolve) =>
          setTimeout(
            () =>
              resolve(
                json({
                  results: [
                    { index: 0, type: 'START', status: 'OK', sessionId: 'server-1' },
                    { index: 1, type: 'LOG_SET', status: 'OK' },
                  ],
                }),
              ),
            10,
          ),
        ),
    );

    await Promise.all([flushOutbox(), flushOutbox(), flushOutbox()]);

    expect(fetchMock.callsTo('POST', '/api/v1/sessions/sync')).toHaveLength(1);
  });

  it('never sends the same set twice — the whole point of the outbox', async () => {
    await queueStartAndSet();
    fetchMock.on('POST', '/api/v1/sessions/sync', () =>
      json({
        results: [
          { index: 0, type: 'START', status: 'OK', sessionId: 'server-1' },
          { index: 1, type: 'LOG_SET', status: 'OK' },
        ],
      }),
    );

    await flushOutbox();
    await flushOutbox();

    const bodies = fetchMock
      .callsTo('POST', '/api/v1/sessions/sync')
      .map((call) => JSON.parse(call.body ?? '{}'));
    expect(bodies).toHaveLength(1);
  });

  it('keeps everything queued when the request never reaches the server', async () => {
    await queueStartAndSet();
    fetchMock.on('POST', '/api/v1/sessions/sync', () => problem(503));

    await expect(flushOutbox()).resolves.toMatchObject({ transportFailed: true });

    // Nothing consumed, no attempt burned: this was the network, not the payload.
    expect(await pendingCount()).toBe(2);
    expect((await db.outbox.toArray()).every((i) => i.attempts === 0)).toBe(true);
  });

  it('backs a rejected item off instead of retrying it in a loop', async () => {
    await queueStartAndSet();
    fetchMock.on('POST', '/api/v1/sessions/sync', () =>
      json({
        results: [
          { index: 0, type: 'START', status: 'ERROR', error: 'Dia de treino não encontrado.' },
          { index: 1, type: 'LOG_SET', status: 'ERROR', error: 'Sessão não encontrada.' },
        ],
      }),
    );

    await flushOutbox();

    const [start] = await db.outbox.orderBy('id').toArray();
    expect(start).toMatchObject({
      attempts: 1,
      failed: 0,
      lastError: 'Dia de treino não encontrado.',
    });
    expect(start!.retryAt).toBeGreaterThan(Date.now());
  });

  it('parks an item the server keeps refusing so the queue is not stuck forever', async () => {
    await enqueue({
      sessionClientUuid: SESSION_A,
      type: 'START',
      payload: { clientUuid: SESSION_A },
    });
    fetchMock.on('POST', '/api/v1/sessions/sync', () =>
      json({ results: [{ index: 0, type: 'START', status: 'ERROR', error: 'Inválido.' }] }),
    );

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await db.outbox.toCollection().modify({ retryAt: 0 });
      await flushOutbox();
    }

    const [parked] = await db.outbox.toArray();
    expect(parked).toMatchObject({ attempts: 6, failed: 1 });
    // Parked items no longer count as "pending sync" in the header.
    expect(await pendingCount()).toBe(0);
  });
});
