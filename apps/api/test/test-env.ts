import { type Env } from '../src/config/env';

/** A complete, valid `Env` for e2e tests — reads DATABASE_URL/REDIS_URL from the process
 * (set via dotenv from the root `.env`, same as `pnpm db:*`), fixed values elsewhere. */
export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    API_PREFIX: 'api/v1',
    DATABASE_URL: process.env.DATABASE_URL ?? '',
    REDIS_URL: process.env.REDIS_URL ?? '',
    LOG_LEVEL: 'error',
    CORS_ORIGINS: 'http://localhost:5173',
    PUBLIC_APP_URL: 'http://localhost:8080',
    JWT_ACCESS_SECRET: 'test-access-secret-'.repeat(2),
    JWT_REFRESH_SECRET: 'test-refresh-secret-'.repeat(2),
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
    COOKIE_DOMAIN: undefined,
    S3_BUCKET: process.env.S3_BUCKET ?? 'personal-media',
    S3_REGION: process.env.S3_REGION ?? 'us-east-1',
    S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    S3_PUBLIC_ENDPOINT: process.env.S3_PUBLIC_ENDPOINT ?? 'http://localhost:9000',
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? process.env.MINIO_ROOT_USER ?? 'minioadmin',
    S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? process.env.MINIO_ROOT_PASSWORD ?? '',
    S3_FORCE_PATH_STYLE: true,
    ...overrides,
  };
}
