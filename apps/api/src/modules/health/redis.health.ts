import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const alive = await this.redis.ping();
    const result = this.getStatus(key, alive);
    if (alive) return result;
    throw new HealthCheckError('Redis is unreachable', result);
  }
}
