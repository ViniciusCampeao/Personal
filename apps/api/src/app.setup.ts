import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { corsOrigins, type Env } from './config/env';

/**
 * Everything that has to be wired onto the Nest app instance.
 * Shared by `main.ts` and the e2e suite so tests exercise the real configuration.
 */
export function configureApp(app: NestExpressApplication, env: Env): void {
  // Behind nginx (and Cloudflare Tunnel in production, see infra/nginx): trust the
  // X-Forwarded-For it sets so req.ip / AuditLog.ip capture the real client, not the
  // proxy's loopback address.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix(env.API_PREFIX, { exclude: ['health', 'health/ready'] });
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableCors({ origin: corsOrigins(env), credentials: true });
  app.enableShutdownHooks();
}
