import { json, mockFetch, problem, type FetchMock } from '@/test-utils/fetch-mock';
import { getAccessToken, refreshSession, resetAuthStore, setSessionListener } from './auth-store';

const SESSION = {
  accessToken: 'fresh-token',
  user: { id: 'u1', tenantId: 't1', name: 'Ana', email: 'ana@x.com', role: 'STUDENT' },
};

describe('refreshSession', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = mockFetch();
    resetAuthStore();
  });

  afterEach(() => {
    fetchMock.restore();
    resetAuthStore();
  });

  it('stores the token and notifies the listener', async () => {
    fetchMock.on('POST', '/api/v1/auth/refresh', json(SESSION));
    const listener = jest.fn();
    setSessionListener(listener);

    await expect(refreshSession()).resolves.toBe('fresh-token');

    expect(getAccessToken()).toBe('fresh-token');
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'fresh-token' }));
  });

  it('shares one in-flight request between concurrent callers', async () => {
    // Not an optimisation: the API consumes the refresh token on use and reads a replayed
    // `jti` as theft, revoking every session the user has.
    fetchMock.on(
      'POST',
      '/api/v1/auth/refresh',
      () => new Promise<Response>((resolve) => setTimeout(() => resolve(json(SESSION)), 10)),
    );

    const first = refreshSession();
    const second = refreshSession();
    expect(first).toBe(second);

    await Promise.all([first, second]);

    expect(fetchMock.callsTo('POST', '/api/v1/auth/refresh')).toHaveLength(1);
  });

  it('starts a new request once the previous one settled', async () => {
    fetchMock.on('POST', '/api/v1/auth/refresh', json(SESSION));

    await refreshSession();
    await refreshSession();

    expect(fetchMock.callsTo('POST', '/api/v1/auth/refresh')).toHaveLength(2);
  });

  it('clears the session when there is no valid refresh cookie', async () => {
    fetchMock.on('POST', '/api/v1/auth/refresh', () => problem(401));
    const listener = jest.fn();
    setSessionListener(listener);

    await expect(refreshSession()).resolves.toBeNull();

    expect(getAccessToken()).toBeNull();
    expect(listener).toHaveBeenCalledWith(null);
  });
});
