import { corsOrigins, validateEnv } from './env';

const MINIMUM = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  S3_BUCKET: 'personal-media',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin-secret',
};

describe('validateEnv', () => {
  it('applies defaults for everything optional', () => {
    const env = validateEnv({ ...MINIMUM });
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.API_PREFIX).toBe('api/v1');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.JWT_ACCESS_TTL).toBe('15m');
    expect(env.JWT_REFRESH_TTL).toBe('7d');
  });

  it('coerces PORT from the string the process actually receives', () => {
    expect(validateEnv({ ...MINIMUM, PORT: '8080' }).PORT).toBe(8080);
  });

  it('fails loudly and names the missing variable', () => {
    expect(() => validateEnv({ REDIS_URL: MINIMUM.REDIS_URL })).toThrow(/DATABASE_URL/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...MINIMUM, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('rejects a JWT secret that is too short to be safe', () => {
    expect(() => validateEnv({ ...MINIMUM, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('rejects a malformed duration string', () => {
    expect(() => validateEnv({ ...MINIMUM, JWT_ACCESS_TTL: '15 minutes' })).toThrow(
      /JWT_ACCESS_TTL/,
    );
  });
});

describe('corsOrigins', () => {
  it('splits and trims the comma-separated list', () => {
    const env = validateEnv({
      ...MINIMUM,
      CORS_ORIGINS: 'http://localhost:5173, https://app.example.com ,',
    });
    expect(corsOrigins(env)).toEqual(['http://localhost:5173', 'https://app.example.com']);
  });
});
