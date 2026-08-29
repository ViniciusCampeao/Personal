/**
 * Route-aware `fetch` mock.
 *
 * MSW would be the usual choice, but its v2 CommonJS build depends on ESM-only packages
 * that this CJS Jest runner can't load without a brittle `transformIgnorePatterns` list.
 * Spying on `fetch` is also what the rest of the suite already does — this just adds
 * matching and call recording on top so tests can assert *how many* times an endpoint
 * was hit, which is the point of the refresh single-flight spec.
 */
export interface RecordedCall {
  method: string;
  url: string;
  headers: Headers;
  body: string | null;
}

type Responder = (call: RecordedCall) => Response | Promise<Response>;

interface Route {
  method: string;
  url: string;
  respond: Responder;
}

export interface FetchMock {
  /** Registers a responder; a later registration for the same route wins. */
  on: (method: string, url: string, respond: Responder | Response) => void;
  calls: RecordedCall[];
  callsTo: (method: string, url: string) => RecordedCall[];
  /** Nth recorded call, failing loudly instead of handing back `undefined`. */
  call: (index: number) => RecordedCall;
  restore: () => void;
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

/** 204 responses must not carry a body — `new Response('{}', { status: 204 })` throws. */
export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/** RFC 7807 error body, the API's only error format. */
export function problem(status: number, body: Record<string, unknown> = {}): Response {
  return json({ type: 'about:blank', title: 'Erro', status, ...body }, { status });
}

export function mockFetch(): FetchMock {
  const routes: Route[] = [];
  const calls: RecordedCall[] = [];

  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init.method ?? 'GET').toUpperCase();
      const call: RecordedCall = {
        method,
        url,
        headers: new Headers(init.headers),
        body: typeof init.body === 'string' ? init.body : null,
      };
      calls.push(call);

      // Last match wins, so a test can override a route registered in `beforeEach`.
      const route = [...routes].reverse().find((r) => r.method === method && r.url === url);
      if (!route) {
        throw new Error(`Nenhuma rota registrada para ${method} ${url}`);
      }
      return route.respond(call);
    });

  return {
    on(method, url, respond) {
      routes.push({
        method: method.toUpperCase(),
        url,
        respond: typeof respond === 'function' ? respond : () => respond.clone(),
      });
    },
    calls,
    callsTo: (method, url) =>
      calls.filter((c) => c.method === method.toUpperCase() && c.url === url),
    call(index) {
      const recorded = calls[index];
      if (!recorded)
        throw new Error(`Nenhuma chamada de índice ${index} (total: ${calls.length}).`);
      return recorded;
    },
    restore: () => spy.mockRestore(),
  };
}
