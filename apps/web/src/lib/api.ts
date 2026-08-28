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

/**
 * Same-origin fetch wrapper. `credentials: 'include'` is already here because the refresh
 * token lands in an httpOnly cookie in M1.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path.startsWith('/health') ? path : `${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...init.headers },
  });

  if (!response.ok) {
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
    throw new ApiError(problem, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface HealthStatus {
  status: string;
  uptimeSeconds: number;
}

export function fetchHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>('/health');
}
