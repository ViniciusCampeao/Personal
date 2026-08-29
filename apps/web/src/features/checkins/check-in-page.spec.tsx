import { screen, waitFor, within } from '@testing-library/react';
import { json, mockFetch, problem, type FetchMock } from '@/test-utils/fetch-mock';
import { resetLocalDb } from '@/test-utils/indexeddb';
import { renderApp } from '@/test-utils/render';
import { resetAuthStore } from '@/features/auth/auth-store';
import { resetSyncEngine } from '@/features/sync/sync-engine';

const STUDENT = {
  accessToken: 'token',
  user: { id: 'u1', tenantId: 't1', name: 'Ana', email: 'ana@x.com', role: 'STUDENT' },
};

describe('CheckInPage', () => {
  let fetchMock: FetchMock;

  beforeEach(async () => {
    fetchMock = mockFetch();
    resetAuthStore();
    resetSyncEngine();
    await resetLocalDb();
    fetchMock.on('POST', '/api/v1/auth/refresh', json(STUDENT));
    fetchMock.on('POST', '/api/v1/sessions/sync', () => problem(503));
    fetchMock.on('GET', '/api/v1/notifications?unreadOnly=true&limit=20', json({ items: [] }));
    fetchMock.on('GET', '/api/v1/students/u1/check-ins?limit=8', json({ items: [] }));
  });

  afterEach(() => {
    fetchMock.restore();
    resetAuthStore();
    resetSyncEngine();
  });

  it('submits the week without ever sending a date', async () => {
    fetchMock.on('GET', '/api/v1/me/check-in/current', json({}));
    fetchMock.on('POST', '/api/v1/me/check-in', json({ id: 'c1', weekStart: '2026-08-24' }));
    const { user } = renderApp({ route: '/app/check-in' });

    const sleep = await screen.findByRole('radiogroup', { name: 'Qualidade do sono' });
    await user.click(within(sleep).getByRole('radio', { name: '4' }));
    await user.click(screen.getByRole('button', { name: 'Enviar check-in' }));

    await waitFor(() => expect(fetchMock.callsTo('POST', '/api/v1/me/check-in')).toHaveLength(1));
    const body = JSON.parse(fetchMock.callsTo('POST', '/api/v1/me/check-in')[0]!.body ?? '{}');
    expect(body).toEqual({ sleepQuality: 4 });
    // The server owns the week boundary — a client-sent date could target the wrong one.
    expect(body).not.toHaveProperty('weekStart');
  });

  it('lets the student correct an answer already given this week', async () => {
    fetchMock.on(
      'GET',
      '/api/v1/me/check-in/current',
      json({ id: 'c1', weekStart: '2026-08-24', sleepQuality: 2, energy: 3, notes: 'cansada' }),
    );
    renderApp({ route: '/app/check-in' });

    expect(await screen.findByRole('button', { name: 'Atualizar check-in' })).toBeInTheDocument();
    const sleep = screen.getByRole('radiogroup', { name: 'Qualidade do sono' });
    expect(within(sleep).getByRole('radio', { name: '2' })).toHaveAttribute('aria-checked', 'true');
  });
});
