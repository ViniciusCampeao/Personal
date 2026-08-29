import { json, mockFetch, problem, type FetchMock } from '@/test-utils/fetch-mock';
import { ApiError, apiFetch, configureApiAuth } from './api';

describe('apiFetch', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    configureApiAuth(null);
  });

  it('prefixes the versioned API base', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await apiFetch('/students');

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/students', expect.anything());
  });

  it('leaves /health outside the versioned prefix', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));

    await apiFetch('/health');

    expect(fetchMock).toHaveBeenCalledWith('/health', expect.anything());
  });

  it('throws ApiError carrying the problem+json body', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ title: 'Acesso negado', status: 403, detail: 'Não é seu aluno' }),
        {
          status: 403,
        },
      ),
    );

    await expect(apiFetch('/students/x')).rejects.toMatchObject({
      status: 403,
      problem: { title: 'Acesso negado', detail: 'Não é seu aluno' },
    });
  });

  it('still throws ApiError when the gateway returns HTML', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('<html>502</html>', { status: 502 }));

    await expect(apiFetch('/students')).rejects.toBeInstanceOf(ApiError);
  });

  it('returns undefined on 204', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiFetch('/sessions/x')).resolves.toBeUndefined();
  });
});

describe('apiFetch — authentication', () => {
  let fetchMock: FetchMock;

  /** Minimal auth bridge whose refresh behaviour each test decides. */
  function bridge(options: { token?: string | null; refresh: () => Promise<string | null> }) {
    const onUnauthenticated = jest.fn();
    configureApiAuth({
      getToken: () => options.token ?? null,
      refresh: options.refresh,
      onUnauthenticated,
    });
    return { onUnauthenticated };
  }

  beforeEach(() => {
    fetchMock = mockFetch();
  });

  afterEach(() => {
    fetchMock.restore();
    configureApiAuth(null);
  });

  it('sends the bearer token', async () => {
    bridge({ token: 'token-abc', refresh: async () => null });
    fetchMock.on('GET', '/api/v1/students', json([]));

    await apiFetch('/students');

    expect(fetchMock.call(0).headers.get('Authorization')).toBe('Bearer token-abc');
  });

  it('omits the token when the call opts out of auth', async () => {
    bridge({ token: 'token-abc', refresh: async () => null });
    fetchMock.on('POST', '/api/v1/auth/login', json({ accessToken: 'x' }));

    await apiFetch('/auth/login', { method: 'POST' }, { auth: 'none' });

    expect(fetchMock.call(0).headers.get('Authorization')).toBeNull();
  });

  it('refreshes once on 401 and replays the request with the new token', async () => {
    const refresh = jest.fn(async () => 'fresh-token');
    bridge({ token: 'stale-token', refresh });
    fetchMock.on('GET', '/api/v1/students', (call) =>
      call.headers.get('Authorization') === 'Bearer stale-token'
        ? problem(401, { title: 'Não autenticado' })
        : json([{ id: 'a' }]),
    );

    await expect(apiFetch('/students')).resolves.toEqual([{ id: 'a' }]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.callsTo('GET', '/api/v1/students').map((c) => c.headers.get('Authorization')),
    ).toEqual(['Bearer stale-token', 'Bearer fresh-token']);
  });

  it('refreshes exactly once when several requests get a 401 at the same time', async () => {
    // The API consumes the refresh token on use and treats a replayed `jti` as theft,
    // revoking every session — a second concurrent refresh would log the user out
    // everywhere, not merely waste a request.
    let refreshCalls = 0;
    let inFlight: Promise<string | null> | null = null;
    const refresh = () => {
      inFlight ??= new Promise<string | null>((resolve) => {
        refreshCalls += 1;
        setTimeout(() => resolve('fresh-token'), 10);
      }).finally(() => {
        inFlight = null;
      });
      return inFlight;
    };
    bridge({ token: 'stale-token', refresh });
    fetchMock.on('GET', '/api/v1/students', (call) =>
      call.headers.get('Authorization') === 'Bearer stale-token'
        ? problem(401, { title: 'Não autenticado' })
        : json([]),
    );

    await Promise.all([apiFetch('/students'), apiFetch('/students'), apiFetch('/students')]);

    expect(refreshCalls).toBe(1);
  });

  it('reports the session as lost and rethrows when the refresh fails', async () => {
    const { onUnauthenticated } = bridge({ token: 'stale-token', refresh: async () => null });
    fetchMock.on('GET', '/api/v1/students', () => problem(401, { title: 'Não autenticado' }));

    await expect(apiFetch('/students')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('gives up when the replayed request is refused as well', async () => {
    // A token minted a moment ago being rejected is not a stale-token problem: outside
    // `/auth/*` the API only answers 401 from the access guard, so the session is gone.
    const { onUnauthenticated } = bridge({ token: 'stale-token', refresh: async () => 'fresh' });
    fetchMock.on('GET', '/api/v1/students', () => problem(401, { title: 'Não autenticado' }));

    await expect(apiFetch('/students')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock.callsTo('GET', '/api/v1/students')).toHaveLength(2);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('never tries to refresh the refresh call itself', async () => {
    const refresh = jest.fn(async () => 'fresh-token');
    bridge({ token: null, refresh });
    fetchMock.on('POST', '/api/v1/auth/refresh', () => problem(401));

    await expect(
      apiFetch('/auth/refresh', { method: 'POST' }, { auth: 'none' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(refresh).not.toHaveBeenCalled();
  });
});
