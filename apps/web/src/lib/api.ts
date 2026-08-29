/** Shape of an RFC 7807 response (the API's only error format — convention §14). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  requestId?: string;
  errors?: string[];
}

export class ApiError extends Error {
  constructor(
    readonly problem: ProblemDetails,
    readonly status: number,
  ) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
  }
}

export const API_BASE = '/api/v1';

export interface ApiFetchOptions {
  /**
   * `required` (default) sends the bearer token and retries once through a token
   * refresh on 401. `none` is for the endpoints that establish a session — sending a
   * stale token there, or refreshing on their 401, would loop.
   */
  auth?: 'required' | 'none';
}

interface AuthBridge {
  getToken: () => string | null;
  refresh: () => Promise<string | null>;
  onUnauthenticated: () => void;
}

let authBridge: AuthBridge | null = null;

/**
 * Wires the auth layer in at boot. Injected rather than imported so `lib/` never depends
 * on `features/` — otherwise `api.ts` and `auth-store.ts` would import each other.
 */
export function configureApiAuth(bridge: AuthBridge | null): void {
  authBridge = bridge;
}

function resolveUrl(path: string): string {
  // /health and /health/ready sit outside the global API prefix.
  return path.startsWith('/health') ? path : `${API_BASE}${path}`;
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: ProblemDetails = {
    type: 'about:blank',
    title: 'Falha na comunicação com o servidor',
    status: response.status,
  };
  try {
    problem = { ...problem, ...(await response.json()) };
  } catch {
    // non-JSON error body (proxy/gateway); keep the generic problem above
  }
  return new ApiError(problem, response.status);
}

function send(path: string, init: RequestInit, token: string | null): Promise<Response> {
  return fetch(resolveUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

/**
 * Same-origin fetch wrapper. `credentials: 'include'` matters for the httpOnly refresh
 * cookie, which the API scopes to `/api/v1/auth`.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  { auth = 'required' }: ApiFetchOptions = {},
): Promise<T> {
  const useAuth = auth === 'required' && authBridge !== null;
  let response = await send(path, init, useAuth ? authBridge!.getToken() : null);

  if (response.status === 401 && useAuth) {
    const token = await authBridge!.refresh();
    // Replay once, rebuilding from `path`/`init` — a consumed Request can't be reused.
    if (token) response = await send(path, init, token);
    // Outside `/auth/*` the API only answers 401 from the access guard (a wrong role is
    // 403), so a token minted moments ago being refused means the session is gone.
    if (!token || response.status === 401) authBridge!.onUnauthenticated();
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface HealthStatus {
  status: string;
  uptimeSeconds: number;
}

export function fetchHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>('/health', {}, { auth: 'none' });
}
