import { ApiError, apiFetch } from './api';

describe('apiFetch', () => {
  afterEach(() => jest.restoreAllMocks());

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
