import type { TodayResponseDto } from '@pt/shared';
import { db } from '@/lib/db';
import { json, mockFetch, problem, type FetchMock } from '@/test-utils/fetch-mock';
import { resetLocalDb } from '@/test-utils/indexeddb';
import { pendingCount } from '@/features/sync/outbox';
import { flushOutbox, resetSyncEngine } from '@/features/sync/sync-engine';
import {
  finishSession,
  getActiveSession,
  getSetsOf,
  logSet,
  pruneSyncedSessions,
  startSession,
  substituteExercise,
  undoSet,
} from './workout-store';

const TODAY: TodayResponseDto = {
  hasActiveProgram: true,
  programId: 'prog-1',
  workoutDayId: 'day-1',
  dayLabel: 'A — Superiores',
  openSessionId: null,
  exercises: [
    {
      prescribedExerciseId: 'pe-2',
      exerciseId: 'ex-2',
      exerciseName: 'Remada curvada',
      equipment: 'BARBELL',
      movementPattern: 'HORIZONTAL_PULL',
      orderIndex: 2,
      groupKey: null,
      groupOrder: null,
      technique: 'NORMAL',
      restSeconds: 90,
      tempo: null,
      notes: null,
      sets: [
        {
          id: 's1',
          setNumber: 1,
          setType: 'WORK',
          repsMin: 8,
          repsMax: 10,
          targetLoadKg: null,
          targetRir: 2,
          targetRpe: null,
          targetSeconds: null,
          targetDistanceM: null,
          restSecondsOverride: null,
        },
      ],
      lastPerformance: null,
    },
    {
      prescribedExerciseId: 'pe-1',
      exerciseId: 'ex-1',
      exerciseName: 'Supino reto',
      equipment: 'BARBELL',
      movementPattern: 'HORIZONTAL_PUSH',
      orderIndex: 1,
      groupKey: null,
      groupOrder: null,
      technique: 'NORMAL',
      restSeconds: 120,
      tempo: null,
      notes: null,
      sets: [
        {
          id: 's2',
          setNumber: 1,
          setType: 'WORK',
          repsMin: 8,
          repsMax: 10,
          targetLoadKg: 60,
          targetRir: 2,
          targetRpe: null,
          targetSeconds: null,
          targetDistanceM: null,
          restSecondsOverride: null,
        },
      ],
      lastPerformance: { loadKg: 60, reps: 10, doneAt: '2026-08-22T10:00:00.000Z' },
    },
  ],
};

describe('workout-store', () => {
  let fetchMock: FetchMock;

  beforeEach(async () => {
    fetchMock = mockFetch();
    resetSyncEngine();
    await resetLocalDb();
    // Offline by default: these operations must not depend on the network at all.
    fetchMock.on('POST', '/api/v1/sessions/sync', () => problem(503));
  });

  afterEach(() => {
    fetchMock.restore();
    resetSyncEngine();
  });

  it('starts a workout offline, in prescribed order', async () => {
    const session = await startSession(TODAY);

    expect(session.exercises.map((e) => e.exerciseName)).toEqual(['Supino reto', 'Remada curvada']);
    expect(await getActiveSession()).toMatchObject({ clientUuid: session.clientUuid });
    expect(await pendingCount()).toBe(1);
  });

  it('resumes the workout already in progress instead of starting a second one', async () => {
    const first = await startSession(TODAY);
    const second = await startSession(TODAY);

    expect(second.clientUuid).toBe(first.clientUuid);
    expect(await db.sessions.count()).toBe(1);
  });

  it('records a set with no network and queues exactly one write for it', async () => {
    const session = await startSession(TODAY);

    const set = await logSet(session.clientUuid, 'pe-1', { setNumber: 1, reps: 10, loadKg: 62.5 });

    expect(await getSetsOf(session.clientUuid)).toEqual([set]);
    expect(await pendingCount()).toBe(2);
    const queued = await db.outbox.orderBy('id').last();
    expect(queued).toMatchObject({ type: 'LOG_SET', prescribedExerciseId: 'pe-1' });
    // Optional fields the student left blank are omitted, not sent as null — the API's
    // schema declares them `.optional()`, which rejects an explicit null.
    expect(queued?.payload).not.toHaveProperty('rir');
  });

  it('replays a whole offline workout without duplicating anything (spec §12)', async () => {
    const session = await startSession(TODAY);
    await logSet(session.clientUuid, 'pe-1', { setNumber: 1, reps: 10, loadKg: 60 });
    await logSet(session.clientUuid, 'pe-1', { setNumber: 2, reps: 8, loadKg: 60 });
    await finishSession(session.clientUuid, { perceivedEffort: 8 });

    const seen: string[] = [];
    fetchMock.on('POST', '/api/v1/sessions/sync', (call) => {
      const body = JSON.parse(call.body ?? '{}') as {
        items: { payload: { clientUuid?: string } }[];
      };
      for (const sent of body.items)
        if (sent.payload.clientUuid) seen.push(sent.payload.clientUuid);
      return json({
        results: body.items.map((_, index) => ({
          index,
          type: 'LOG_SET',
          status: 'OK',
          sessionId: 'server-1',
        })),
      });
    });

    // Each offline write already tried to deliver and got a 503, so the queue is sitting
    // in its backoff window; skip the wait rather than sleep through it.
    await db.outbox.toCollection().modify({ retryAt: 0 });
    await flushOutbox();
    await flushOutbox();

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(3); // START + two sets; FINISH carries no clientUuid
    expect(await pendingCount()).toBe(0);
  });

  it('undoes a set only while it has not left the device', async () => {
    const session = await startSession(TODAY);
    const set = await logSet(session.clientUuid, 'pe-1', { setNumber: 1, reps: 10 });

    await expect(undoSet(set)).resolves.toBe(true);
    expect(await getSetsOf(session.clientUuid)).toEqual([]);
    // Second time there is nothing queued any more, so the answer is an honest "no".
    await expect(undoSet(set)).resolves.toBe(false);
  });

  it('swaps an exercise and forgets the reference load of the movement it replaced', async () => {
    const session = await startSession(TODAY);

    await substituteExercise(
      session.clientUuid,
      'pe-1',
      { exerciseId: 'ex-9', exerciseName: 'Supino com halteres' },
      'Barra ocupada',
    );

    const updated = await db.sessions.get(session.clientUuid);
    const swapped = updated?.exercises.find((e) => e.prescribedExerciseId === 'pe-1');
    expect(swapped).toMatchObject({
      exerciseName: 'Supino com halteres',
      lastPerformance: null,
      substitutedFrom: { exerciseName: 'Supino reto', reason: 'Barra ocupada' },
    });
  });

  it('keeps a finished workout on the device until it is fully delivered', async () => {
    const session = await startSession(TODAY);
    await logSet(session.clientUuid, 'pe-1', { setNumber: 1, reps: 10 });
    await finishSession(session.clientUuid);

    await expect(pruneSyncedSessions()).resolves.toBe(0);

    await db.outbox.clear();
    await expect(pruneSyncedSessions()).resolves.toBe(1);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
  });
});
