import { type Role } from '@prisma/client';
import { type Request } from 'express';

/** Claims signed into the access token (15 min, spec §1). Kept minimal on purpose. */
export interface AccessTokenPayload {
  sub: string; // userId
  tenantId: string;
  role: Role;
  email: string;
}

/**
 * Claims signed into the refresh token (7 days, httpOnly cookie). `tenantId` is
 * included because it never changes for a user in this schema — that lets refresh jump
 * straight into a scoped Prisma call without an unscoped lookup first. `role` and
 * `email` are deliberately left out: they CAN change, and baking them into a
 * week-long-lived token would let a demoted/renamed account keep acting on stale
 * claims. `jti` is the rotation key stored in Redis (see TokenService).
 */
export interface RefreshTokenPayload {
  sub: string;
  tenantId: string;
  jti: string;
}

export interface RequestUser {
  id: string;
  tenantId: string;
  role: Role;
  email: string;
}

export interface RequestWithUser extends Request {
  user?: RequestUser;
}
