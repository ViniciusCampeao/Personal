import { screen, waitFor } from '@testing-library/react';
import { db, type LocalSession } from '@/lib/db';
import { json, mockFetch, problem, type FetchMock } from '@/test-utils/fetch-mock';
import { resetLocalDb } from '@/test-utils/indexeddb';
import { renderApp } from '@/test-utils/render';
import { resetAuthStore } from '@/features/auth/auth-store';
import { pendingCount } from '@/features/sync/outbox';
import { resetSyncEngine } from '@/features/sync/sync-engine';

const SESSION_UUID = '11111111-1111-4111-8111-111111111111';

const STUDENT = {
  accessToken: 'token',
  user: { id: 'u1', tenantId: 't1', name: 'Ana Souza', email: 'ana@x.com', role: 'STUDENT' },
};

function localSession(): LocalSession {
  return {
    clientUuid: SESSION_UUID,
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
    exercises: [
      {
        prescribedExerciseId: 'pe-1',
        exerciseId: 'ex-1',
        exerciseName: 'Supino reto',
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
          {
            id: 's2',
            setNumber: 2,
            setType: 'WORK',
            repsMin: 8,
            repsMax: 10,
            targetLoadKg: 60,
            targetRir: 1,
            targetRpe: null,
            targetSeconds: null,
            targetDistanceM: null,
            restSecondsOverride: null,
          },
        ],
        lastPerformance: { loadKg: 57.5, reps: 10, doneAt: '2026-08-22T10:00:00.000Z' },
        substitutedFrom: null,
      },
    ],
  };
}

describe('WorkoutExecutionPage', () => {
  let fetchMock: FetchMock;

  beforeEach(async () => {
    fetchMock = mockFetch();
    resetAuthStore();
    resetSyncEngine();
    await resetLocalDb();
    fetchMock.on('POST', '/api/v1/auth/refresh', json(STUDENT));
    // The gym has no signal: every network call fails, and the screen must not care.
    fetchMock.on('POST', '/api/v1/sessions/sync', () => problem(503));
    await db.sessions.add(localSession());
  });

  afterEach(() => {
    fetchMock.restore();
    resetAuthStore();
    resetSyncEngine();
  });

  function open() {
    return renderApp({ route: `/app/treino/${SESSION_UUID}` });
  }

  it('shows what was prescribed and how far the workout has gone', async () => {
    open();

    expect(await screen.findByRole('heading', { name: 'Supino reto' })).toBeInTheDocument();
    expect(screen.getByText(/2 × 8–10/)).toBeInTheDocument();
    expect(screen.getByText('0 de 2 séries')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('pre-fills the set with the prescribed target instead of an empty form', async () => {
    open();

    await screen.findByRole('heading', { name: 'Supino reto' });
    expect(await screen.findByLabelText('Carga')).toHaveValue('60');
    expect(screen.getByLabelText('Reps')).toHaveValue('10');
    expect(screen.getByLabelText('RIR')).toHaveValue('2');
  });

  it('records a set with no network at all and queues it for later', async () => {
    const { user } = open();
    await screen.findByRole('heading', { name: 'Supino reto' });

    await user.click(screen.getByRole('button', { name: 'Registrar série' }));

    expect(await screen.findByText('Série 1')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('1 de 2 séries')).toBeInTheDocument());
    expect(await db.sets.count()).toBe(1);
    expect(await pendingCount()).toBe(1);
  });

  it('starts the rest countdown once the set is in', async () => {
    const { user } = open();
    await screen.findByRole('heading', { name: 'Supino reto' });

    await user.click(screen.getByRole('button', { name: 'Registrar série' }));

    expect(await screen.findByText('Descanso')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pular' })).toBeInTheDocument();
  });

  it('lets the student take back a set that has not been sent yet', async () => {
    const { user } = open();
    await screen.findByRole('heading', { name: 'Supino reto' });
    await user.click(screen.getByRole('button', { name: 'Registrar série' }));

    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument(),
    );
    expect(await db.sets.count()).toBe(0);
    expect(await pendingCount()).toBe(0);
  });

  it('closes the workout and sends the student home', async () => {
    const { user, router } = open();
    await screen.findByRole('heading', { name: 'Supino reto' });

    await user.click(screen.getByRole('button', { name: 'Finalizar treino' }));
    await user.click(await screen.findByRole('button', { name: 'Concluir treino' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect((await db.sessions.get(SESSION_UUID))?.status).toBe('COMPLETED');
  });

  it('warns that the workout is unfinished before closing it', async () => {
    const { user } = open();
    await screen.findByRole('heading', { name: 'Supino reto' });

    await user.click(screen.getByRole('button', { name: 'Finalizar treino' }));

    expect(await screen.findByText(/Ainda faltam 2 séries/)).toBeInTheDocument();
  });
});
