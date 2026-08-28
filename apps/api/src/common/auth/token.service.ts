import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type Role } from '@prisma/client';
import { RedisService } from '../redis/redis.service';
import { type Env } from '../../config/env';
import { parseDurationSeconds } from './duration';
import { type AccessTokenPayload, type RefreshTokenPayload } from './types';

interface UserForTokens {
  id: string;
  tenantId: string;
  role: Role;
  email: string;
}

function refreshKey(userId: string, jti: string): string {
  return `refresh:${userId}:${jti}`;
}

/**
 * Signs, verifies and rotates the access/refresh JWT pair (spec §1: access 15 min in
 * memory, refresh 7 days in an httpOnly cookie).
 *
 * Refresh tokens are additionally tracked in Redis, one key per `(userId, jti)`, with a
 * TTL matching the token's own expiry. This is what makes `logout` and rotation
 * meaningful — a JWT alone can't be revoked before it expires. Presenting a refresh
 * token whose `jti` is missing from Redis (already rotated, or never issued) is treated
 * as token theft: every refresh session for that user is revoked on the spot.
 */
@Injectable()
export class TokenService {
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly redis: RedisService,
  ) {
    this.refreshTtlSeconds = parseDurationSeconds(
      this.config.get('JWT_REFRESH_TTL', { infer: true }),
    );
  }

  get refreshCookieMaxAgeMs(): number {
    return this.refreshTtlSeconds * 1000;
  }

  signAccessToken(user: UserForTokens): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };
    return this.jwt.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  /** Signs a new refresh token and records its `jti` in Redis so it can be consumed once. */
  async issueRefreshToken(user: Pick<UserForTokens, 'id' | 'tenantId'>): Promise<string> {
    const jti = randomUUID();
    const payload: RefreshTokenPayload = { sub: user.id, tenantId: user.tenantId, jti };
    const token = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_REFRESH_TTL', { infer: true }),
    });
    await this.redis.client.set(refreshKey(user.id, jti), '1', 'EX', this.refreshTtlSeconds);
    return token;
  }

  /**
   * Verifies signature + expiry and consumes the `jti` (single use — this IS the
   * rotation). Throws `UnauthorizedException` for a bad signature, an expired token, or
   * a `jti` that isn't in Redis (already used, or the user was logged out). In that
   * last case every other refresh session for the user is revoked too.
   */
  async verifyAndConsumeRefreshToken(token: string): Promise<RefreshTokenPayload> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const key = refreshKey(payload.sub, payload.jti);
    const deleted = await this.redis.client.del(key);
    if (deleted === 0) {
      await this.revokeAllRefreshTokens(payload.sub);
      throw new UnauthorizedException('Sessão inválida.');
    }
    return payload;
  }

  /**
   * Best-effort decode with NO signature verification — logout only needs the claims to
   * find the Redis key to delete, and must still work even if the token is expired or
   * malformed (e.g. a stale cookie from before a secret rotation).
   */
  decodeRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      const decoded = this.jwt.decode(token);
      if (!decoded || typeof decoded !== 'object') return null;
      const { sub, tenantId, jti } = decoded as Partial<RefreshTokenPayload>;
      if (!sub || !tenantId || !jti) return null;
      return { sub, tenantId, jti };
    } catch {
      return null;
    }
  }

  async revokeRefreshToken(userId: string, jti: string): Promise<void> {
    await this.redis.client.del(refreshKey(userId, jti));
  }

  /** Used on reuse detection and can be called explicitly (e.g. "sign out everywhere"). */
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    const pattern = refreshKey(userId, '*');
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, found] = await this.redis.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      keys.push(...found);
    } while (cursor !== '0');

    if (keys.length > 0) await this.redis.client.del(...keys);
  }
}
