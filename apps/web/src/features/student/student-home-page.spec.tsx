import { screen, waitFor } from '@testing-library/react';
import type { TodayResponseDto } from '@pt/shared';
import { db, TODAY_CACHE_KEY } from '@/lib/db';
import { json, mockFetch, problem, type FetchMock } from '@/test-utils/fetch-mock';
import { resetLocalDb } from '@/test-utils/indexeddb';
import { renderApp } from '@/test-utils/render';
import { resetAuthStore } from '@/features/auth/auth-store';
import { resetSyncEngine } from '@/features/sync/sync-engine';

const STUDENT = {
  accessToken: 'token',
  user: { id: 'u1', tenantId: 't1', name: 'Ana Souza', email: 'ana@x.com', role: 'STUDENT' },
};

const TODAY: TodayResponseDto = {
  hasActiveProgram: true,
  programId: 'prog-1',
  workoutDayId: 'day-1',
  dayLabel: 'A — Superiores',
  openSessionId: null,
  exercises: [
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
          targetLoadKg: 60,
          targetRir: 2,
          targetRpe: null,
          targetSeconds: null,
          targetDistanceM: null,
          restSecondsOverride: null,
        },
      ],
      lastPerformance: null,
    },
  ],
};

describe('StudentHomePage', () => {
  let fetchMock: FetchMock;

  beforeEach(async () => {
    fetchMock = mockFetch();
    resetAuthStore();
    resetSyncEngine();
    await resetLocalDb();
    fetchMock.on('POST', '/api/v1/auth/refresh', json(STUDENT));
    fetchMock.on('GET', '/api/v1/students/u1/progress/adherence?weeks=4', json([]));
    fetchMock.on('GET', '/api/v1/students/u1/records', json([]));
  });

  afterEach(() => {
    fetchMock.restore();
    resetAuthStore();
    resetSyncEngine();
  });

  it('announces the workout of the day', async () => {
    fetchMock.on('GET', '/api/v1/me/today', json(TODAY));
    renderApp({ route: '/app' });

    expect(await screen.findByText(/A — Superiores/)).toBeInTheDocument();
    expect(screen.getByText('Supino reto')).toBeInTheDocument();
  });

  it('says so plainly when no program has been activated yet', async () => {
    fetchMock.on('GET', '/api/v1/me/today', json({ ...TODAY, hasActiveProgram: false }));
    renderApp({ route: '/app' });

    expect(
      await screen.findByText('Seu treinador ainda não ativou um programa para você.'),
    ).toBeInTheDocument();
  });

  it('falls back to the prefetched workout when the phone is offline', async () => {
    // The student often opens the app already inside the gym, with no signal.
    await db.cache.put({ key: TODAY_CACHE_KEY, value: TODAY, fetchedAt: '2026-08-29T09:00:00Z' });
    fetchMock.on('GET', '/api/v1/me/today', () => problem(503));
    renderApp({ route: '/app' });

    expect(await screen.findByText(/A — Superiores/)).toBeInTheDocument();
  });

  it('starts the workout on the device and opens the execution screen', async () => {
    fetchMock.on('GET', '/api/v1/me/today', json(TODAY));
    fetchMock.on('POST', '/api/v1/sessions/sync', () => problem(503));
    const { user, router } = renderApp({ route: '/app' });

    await user.click(await screen.findByRole('button', { name: 'Começar treino' }));

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/app\/treino\//));
    // The session exists locally before the server has ever heard of it.
    expect(await db.sessions.count()).toBe(1);
  });

  it('offers to resume a workout already in progress on this device', async () => {
    fetchMock.on('GET', '/api/v1/me/today', json(TODAY));
    fetchMock.on('POST', '/api/v1/sessions/sync', () => problem(503));
    await db.sessions.add({
      clientUuid: 'aaaaaaaa-1111-4111-8111-111111111111',
      serverId: null,
      workoutDayId: 'day-1',
      programId: 'prog-1',
      dayLabel: 'A — Superiores',
      status: 'IN_PROGRESS',
      startedAt: '2026-08-29T10:00:00.000Z',
      finishedAt: null,
      perceivedEffort: null,
      mood: null,
      notes: null,
      exercises: [],
    });
    renderApp({ route: '/app' });

    expect(await screen.findByRole('button', { name: 'Continuar treino' })).toBeInTheDocument();
  });
});
