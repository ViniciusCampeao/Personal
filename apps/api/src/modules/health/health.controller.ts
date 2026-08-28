import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { Public } from '../../common/auth/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisHealthIndicator } from './redis.health';

/** Health checks are infrastructure, not app data — never behind the auth guard. */
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redisIndicator: RedisHealthIndicator,
  ) {}

  /** Liveness: the process is up. Used by the container healthcheck. */
  @Get()
  live(): { status: string; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) };
  }

  /** Readiness: the process can actually serve traffic (database + cache reachable). */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma),
      () => this.redisIndicator.pingCheck('redis'),
    ]);
  }
}
