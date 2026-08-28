import { randomUUID } from 'node:crypto';
import { type Params } from 'nestjs-pino';
import { type Env } from './env';

/**
 * Structured JSON logs with a `requestId` on every line (convention §14).
 * `tenantId` is added by the tenant middleware in M1.
 */
export function loggerOptions(env: Env): Params {
  const isProduction = env.NODE_ENV === 'production';

  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      genReqId: (req, res) => {
        const existing = req.headers['x-request-id'];
        const id = (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      customProps: (req) => ({ requestId: req.id }),
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') === true },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body.password',
          'req.body.passwordHash',
        ],
        censor: '[redacted]',
      },
      transport: isProduction
        ? undefined
        : { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss.l' } },
    },
  };
}
