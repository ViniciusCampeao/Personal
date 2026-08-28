import { type CookieOptions, type Response } from 'express';
import { type Env } from '../../config/env';

export const REFRESH_COOKIE_NAME = 'pt_refresh';

/** Scoped to /auth so the cookie is never sent on ordinary API calls, only on refresh/logout. */
const REFRESH_COOKIE_PATH_SUFFIX = '/auth';

function baseCookieOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/${env.API_PREFIX}${REFRESH_COOKIE_PATH_SUFFIX}`,
    domain: env.COOKIE_DOMAIN || undefined,
  };
}

export function setRefreshCookie(res: Response, env: Env, token: string, maxAgeMs: number): void {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...baseCookieOptions(env), maxAge: maxAgeMs });
}

export function clearRefreshCookie(res: Response, env: Env): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions(env));
}
