import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthCommonModule } from './common/auth/auth-common.module';
import { JwtAccessGuard } from './common/auth/jwt-access.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { StorageModule } from './common/storage/storage.module';
import { TenantMiddleware } from './common/tenant/tenant.middleware';
import { readEnv, type Env, validateEnv } from './config/env';
import { loggerOptions } from './config/logger';
import { AuthModule } from './modules/auth/auth.module';
import { ExercisesModule } from './modules/exercises/exercises.module';
import { HealthModule } from './modules/health/health.module';
import { InvitesModule } from './modules/invites/invites.module';
import { MediaModule } from './modules/media/media.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { ProgressModule } from './modules/progress/progress.module';
import { SessionsModule } from './modules/sessions/sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => loggerOptions(readEnv(config)),
    }),
    // Global default: 60 requests/min per IP. Login has its own tighter limit
    // (@Throttle on AuthController.login) against credential-stuffing. Effectively
    // disabled under test — e2e specs legitimately log in dozens of times per run.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          { ttl: 60_000, limit: config.get('NODE_ENV', { infer: true }) === 'test' ? 100_000 : 60 },
        ],
      }),
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    AuthCommonModule,
    AuthModule,
    InvitesModule,
    ExercisesModule,
    MediaModule,
    ProgramsModule,
    SessionsModule,
    ProgressModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Order matters: authentication must be checked before role authorization.
    { provide: APP_GUARD, useClass: JwtAccessGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
