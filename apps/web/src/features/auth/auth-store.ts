import { type LoginResponseDto } from '@pt/shared';
import { apiFetch, configureApiAuth } from '@/lib/api';

/**
 * The access token lives in a module singleton, not React state: `apiFetch` runs inside
 * TanStack Query's `queryFn`, outside the component tree, so it cannot read context.
 * Nothing is persisted — the spec keeps the access token in memory and the refresh token
 * in an httpOnly cookie.
 */
let accessToken: string | null = null;
let onSessionChange: ((session: LoginResponseDto | null) => void) | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

/** Test seam: module state outlives a single test within a file. */
export function resetAuthStore(): void {
  accessToken = null;
  refreshPromise = null;
  onSessionChange = null;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setSessionListener(listener: (session: LoginResponseDto | null) => void): void {
  onSessionChange = listener;
}

/** Forgets the session locally — used by logout and by an unrecoverable 401. */
export function clearSession(): void {
  accessToken = null;
  onSessionChange?.(null);
}

/**
 * In-flight refresh, shared by every caller.
 *
 * This is a correctness requirement, not an optimisation. The API rotates and *consumes*
 * the refresh token on every call, and presenting an already-consumed `jti` is treated
 * as token theft — it revokes every session the user has (see the API's
 * `TokenService.verifyAndConsumeRefreshToken`). Two parallel refreshes would log the
 * user out everywhere. React 18's StrictMode double-invoking effects in dev is enough to
 * trigger exactly that, which is why the bootstrap goes through here too.
 */
let refreshPromise: Promise<string | null> | null = null;

export function refreshSession(): Promise<string | null> {
  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function performRefresh(): Promise<string | null> {
  try {
    // The cookie is scoped to /api/v1/auth, so it rides along on this call only.
    const session = await apiFetch<LoginResponseDto>(
      '/auth/refresh',
      { method: 'POST' },
      { auth: 'none' },
    );
    accessToken = session.accessToken;
    onSessionChange?.(session);
    return session.accessToken;
  } catch {
    accessToken = null;
    onSessionChange?.(null);
    return null;
  }
}

/**
 * Wired at module load, not from a React effect: child effects run before the provider's,
 * so a query firing on the very first render would otherwise reach `apiFetch` before the
 * bridge existed — no bearer token, and no refresh on its 401.
 */
configureApiAuth({
  getToken: getAccessToken,
  refresh: refreshSession,
  onUnauthenticated: clearSession,
});
