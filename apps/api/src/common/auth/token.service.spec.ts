import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';
import { type Env } from '../../config/env';

const ENV: Env = {
  NODE_ENV: 'test',
  PORT: 3000,
  API_PREFIX: 'api/v1',
  DATABASE_URL: 'postgresql://x',
  REDIS_URL: 'redis://x',
  LOG_LEVEL: 'silent',
  CORS_ORIGINS: 'http://localhost:5173',
  PUBLIC_APP_URL: 'http://localhost:8080',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
  COOKIE_DOMAIN: undefined,
  S3_BUCKET: 'personal-media',
  S3_REGION: 'us-east-1',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin-secret',
  S3_FORCE_PATH_STYLE: true,
  HEALTH_DATA_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
  VAPID_PUBLIC_KEY: 'test-vapid-public-key',
  VAPID_PRIVATE_KEY: 'test-vapid-private-key',
  VAPID_SUBJECT: 'mailto:test@example.com',
};

function fakeConfig() {
  return { get: (key: keyof Env) => ENV[key] } as unknown as import('@nestjs/config').ConfigService<
    Env,
    true
  >;
}

/** In-memory stand-in for RedisService — only the subset TokenService touches. */
function fakeRedis() {
  const store = new Map<string, string>();
  return {
    client: {
      async set(key: string, value: string) {
        store.set(key, value);
        return 'OK';
      },
      async del(...keys: string[]) {
        let count = 0;
        for (const key of keys) if (store.delete(key)) count += 1;
        return count;
      },
      async scan(cursor: string, _m: string, pattern: string) {
        const prefix = pattern.replace('*', '');
        const matches = [...store.keys()].filter((k) => k.startsWith(prefix));
        return ['0', matches] as [string, string[]];
      },
    },
  } as unknown as import('../redis/redis.service').RedisService;
}

const USER = { id: 'user-1', tenantId: 'tenant-1', role: 'STUDENT' as const, email: 'a@b.com' };

describe('TokenService', () => {
  it('signs an access token that verifies back to the same claims', async () => {
    const service = new TokenService(new JwtService(), fakeConfig(), fakeRedis());
    const token = service.signAccessToken(USER);
    const payload = await service.verifyAccessToken(token);
    expect(payload).toMatchObject({ sub: USER.id, tenantId: USER.tenantId, role: USER.role });
  });

  it('issues a refresh token and consumes it exactly once', async () => {
    const service = new TokenService(new JwtService(), fakeConfig(), fakeRedis());
    const token = await service.issueRefreshToken(USER);

    const payload = await service.verifyAndConsumeRefreshToken(token);
    expect(payload.sub).toBe(USER.id);

    await expect(service.verifyAndConsumeRefreshToken(token)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('revokes every session for a user when a used jti is replayed', async () => {
    const service = new TokenService(new JwtService(), fakeConfig(), fakeRedis());
    const tokenA = await service.issueRefreshToken(USER);
    const tokenB = await service.issueRefreshToken(USER);

    await service.verifyAndConsumeRefreshToken(tokenA);
    // Replaying the already-used token should also burn the still-valid tokenB.
    await expect(service.verifyAndConsumeRefreshToken(tokenA)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.verifyAndConsumeRefreshToken(tokenB)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a refresh token signed with the wrong secret', async () => {
    const service = new TokenService(new JwtService(), fakeConfig(), fakeRedis());
    const rogue = new JwtService().sign(
      { sub: USER.id, tenantId: USER.tenantId, jti: 'x' },
      { secret: 'not-the-real-secret-'.repeat(2) },
    );
    await expect(service.verifyAndConsumeRefreshToken(rogue)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('exposes the refresh TTL in milliseconds for the cookie', () => {
    const service = new TokenService(new JwtService(), fakeConfig(), fakeRedis());
    expect(service.refreshCookieMaxAgeMs).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
