import { screen } from '@testing-library/react';
import { json, mockFetch, problem, type FetchMock } from '@/test-utils/fetch-mock';
import { resetLocalDb } from '@/test-utils/indexeddb';
import { renderApp } from '@/test-utils/render';
import { resetAuthStore } from '@/features/auth/auth-store';
import { resetSyncEngine } from '@/features/sync/sync-engine';

const STUDENT = {
  accessToken: 'token',
  user: { id: 'u1', tenantId: 't1', name: 'Ana', email: 'ana@x.com', role: 'STUDENT' },
};

const ADHERENCE = [
  {
    weekStart: '2026-08-17T00:00:00.000Z',
    completedSessions: 3,
    expectedSessions: 4,
    adherenceRatio: 0.75,
  },
  {
    weekStart: '2026-08-24T00:00:00.000Z',
    completedSessions: 4,
    expectedSessions: 4,
    adherenceRatio: 1,
  },
];

describe('ProgressPage', () => {
  let fetchMock: FetchMock;

  beforeEach(async () => {
    fetchMock = mockFetch();
    resetAuthStore();
    resetSyncEngine();
    await resetLocalDb();
    fetchMock.on('POST', '/api/v1/auth/refresh', json(STUDENT));
    fetchMock.on('POST', '/api/v1/sessions/sync', () => problem(503));
    fetchMock.on('GET', '/api/v1/notifications?unreadOnly=true&limit=20', json({ items: [] }));
    fetchMock.on('GET', '/api/v1/students/u1/progress/volume?weeks=12', json([]));
    fetchMock.on('GET', '/api/v1/students/u1/records', json([]));
  });

  afterEach(() => {
    fetchMock.restore();
    resetAuthStore();
    resetSyncEngine();
  });

  it('publishes the same numbers as a table, not only as a picture', async () => {
    fetchMock.on('GET', '/api/v1/students/u1/progress/adherence?weeks=12', json(ADHERENCE));
    renderApp({ route: '/app/progresso' });

    // The chart itself is aria-hidden; this is what a screen reader gets.
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('3/4')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('changes the window when another range is picked', async () => {
    fetchMock.on('GET', '/api/v1/students/u1/progress/adherence?weeks=12', json(ADHERENCE));
    fetchMock.on('GET', '/api/v1/students/u1/progress/adherence?weeks=4', json(ADHERENCE));
    fetchMock.on('GET', '/api/v1/students/u1/progress/volume?weeks=4', json([]));
    const { user } = renderApp({ route: '/app/progresso' });

    await user.click(await screen.findByRole('button', { name: '4 semanas' }));

    expect(fetchMock.callsTo('GET', '/api/v1/students/u1/progress/adherence?weeks=4')).toHaveLength(
      1,
    );
  });

  it('says there is nothing to show yet instead of drawing an empty chart', async () => {
    fetchMock.on('GET', '/api/v1/students/u1/progress/adherence?weeks=12', json([]));
    renderApp({ route: '/app/progresso' });

    expect(await screen.findByText(/Assim que você concluir alguns treinos/)).toBeInTheDocument();
  });
});
