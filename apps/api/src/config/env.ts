import { z } from 'zod';

/** A `\d+[smhd]` duration string, the only shape `@nestjs/jwt`'s `expiresIn` needs here. */
const durationString = z.string().regex(/^\d+[smhd]$/, 'Use um formato como "15m", "7d".');

/**
 * Every environment variable the API reads today. Anything added here must also land in
 * the root `.env.example` (convention §14). Variables later milestones will need (VAPID)
 * live in `.env.example` but are not validated yet.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().min(1).default('api/v1'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Comma-separated list of origins allowed to call the API with credentials. */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  /** Public address the app is served on — used to build the invite link (spec §5). */
  PUBLIC_APP_URL: z.string().min(1).default('http://localhost:8080'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET precisa ter pelo menos 32 caracteres.'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET precisa ter pelo menos 32 caracteres.'),
  JWT_ACCESS_TTL: durationString.default('15m'),
  JWT_REFRESH_TTL: durationString.default('7d'),
  /** Cookie domain for the refresh token. Empty = host-only cookie. */
  COOKIE_DOMAIN: z.string().optional(),

  /** MinIO/S3-compatible bucket the API signs PUT/GET URLs against (spec §10, §14). */
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1).default('us-east-1'),
  /** Endpoint the API itself reaches (e.g. the `minio` service on the compose network). */
  S3_ENDPOINT: z.string().min(1),
  /** Endpoint that ends up embedded in a presigned URL — must be reachable by the browser. */
  S3_PUBLIC_ENDPOINT: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  // `z.coerce.boolean()` would map the env-string "false" to `true` (JS `Boolean()`
  // coercion) — parse the two literal strings an env var can actually carry.
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  /** Base64 AES-256 key for FieldEncryptionService (spec §10.3) — 32 bytes decoded. */
  HEALTH_DATA_ENCRYPTION_KEY: z.string().refine((value) => {
    try {
      return Buffer.from(value, 'base64').length === 32;
    } catch {
      return false;
    }
  }, 'HEALTH_DATA_ENCRYPTION_KEY precisa ser 32 bytes em base64.'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

/**
 * Rebuilds a full `Env` object from `ConfigService` — useful for helpers (cookie
 * options, etc.) that want a plain value instead of threading `ConfigService` through.
 */
export function readEnv(config: import('@nestjs/config').ConfigService<Env, true>): Env {
  const keys = envSchema.keyof().options;
  const entries = keys.map((key) => [key, config.get(key, { infer: true })]);
  return Object.fromEntries(entries) as Env;
}

export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
