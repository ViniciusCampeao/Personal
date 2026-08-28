const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/**
 * Converts a `\d+[smhd]` string (the same shape `env.ts` validates for JWT_*_TTL, and
 * that `@nestjs/jwt`'s `expiresIn` accepts directly) into whole seconds — needed for
 * the refresh token's Redis TTL and the cookie's `maxAge`.
 */
export function parseDurationSeconds(input: string): number {
  const match = /^(\d+)([smhd])$/.exec(input);
  if (!match) {
    throw new Error(`Invalid duration "${input}". Expected a format like "15m" or "7d".`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_SECONDS[unit as keyof typeof UNIT_SECONDS];
}
