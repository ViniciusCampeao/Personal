import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { readEnv, type Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  const env = readEnv(app.get(ConfigService<Env, true>));
  configureApp(app, env);

  await app.listen(env.PORT, '0.0.0.0');
}

// A failed bootstrap is almost always a missing dependency (database, cache) or a bad
// environment variable. Report it in one line instead of dumping the Prisma bundle.
void bootstrap().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`[fatal] falha ao iniciar a API: ${reason}`);
  process.exit(1);
});
