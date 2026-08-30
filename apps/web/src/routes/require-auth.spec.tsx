import { waitFor } from '@testing-library/react';
import { json, mockFetch, problem, type FetchMock } from '@/test-utils/fetch-mock';
import { renderApp } from '@/test-utils/render';
import { resetAuthStore } from '@/features/auth/auth-store';
import { PATHS } from './paths';

type Role = 'STUDENT' | 'TRAINER' | 'ADMIN';

function session(role: Role) {
  return {
    accessToken: 'token',
    user: { id: 'u1', tenantId: 't1', name: 'Fulano', email: 'f@x.com', role },
  };
}

const EMPTY_DASHBOARD = {
  atRiskStudents: [],
  workoutsToday: [],
  recentPRs: [],
  pendingCheckIns: [],
};

describe('route guards', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = mockFetch();
    resetAuthStore();
    fetchMock.on('GET', '/api/v1/dashboard', json(EMPTY_DASHBOARD));
  });

  afterEach(() => {
    fetchMock.restore();
    resetAuthStore();
  });

  /** The boot refresh decides the session, so every case starts by answering it. */
  function bootAs(role: Role | null) {
    fetchMock.on('POST', '/api/v1/auth/refresh', () => (role ? json(session(role)) : problem(401)));
  }

  it('sends an anonymous visitor to the login screen, remembering where they were going', async () => {
    bootAs(null);
    const { router } = renderApp({ route: PATHS.studentHome });

    await waitFor(() => expect(router.state.location.pathname).toBe(PATHS.login));
    expect(router.state.location.state).toEqual({
      from: expect.objectContaining({ pathname: PATHS.studentHome }),
    });
  });

  it('sends a student who lands in the management area back to their own home', async () => {
    bootAs('STUDENT');
    const { router } = renderApp({ route: PATHS.trainerHome });

    await waitFor(() => expect(router.state.location.pathname).toBe(PATHS.studentHome));
    // A wrong section is a redirect, never a 403 screen.
    expect(fetchMock.callsTo('GET', '/api/v1/dashboard')).toHaveLength(0);
  });

  it('sends a trainer who lands in the student app back to the management area', async () => {
    bootAs('TRAINER');
    const { router } = renderApp({ route: PATHS.studentHome });

    await waitFor(() => expect(router.state.location.pathname).toBe(PATHS.trainerHome));
  });

  it('keeps a signed-in user off the login screen', async () => {
    bootAs('TRAINER');
    const { router } = renderApp({ route: PATHS.login });

    await waitFor(() => expect(router.state.location.pathname).toBe(PATHS.trainerHome));
  });

  it('resolves the root path to the home of whoever is signed in', async () => {
    bootAs('STUDENT');
    const { router } = renderApp({ route: PATHS.root });

    await waitFor(() => expect(router.state.location.pathname).toBe(PATHS.studentHome));
  });

  it('sends an admin to the admin panel', async () => {
    bootAs('ADMIN');
    fetchMock.on('GET', '/api/v1/admin/tenant', json({ id: 't1', name: 'Academia Demo', slug: 'demo' }));
    fetchMock.on('GET', '/api/v1/admin/users', json([]));
    fetchMock.on('GET', '/api/v1/admin/audit-log', json({ items: [], nextCursor: null }));
    const { router } = renderApp({ route: PATHS.root });

    await waitFor(() => expect(router.state.location.pathname).toBe(PATHS.admin));
  });
});
