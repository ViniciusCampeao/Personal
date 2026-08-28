import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { type Env } from '../../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService<Env, true>) {
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // Keep the API bootable when Redis is briefly unavailable; health check reports it.
      enableOfflineQueue: false,
    });
    this.client.on('error', () => {
      /* handled by the health check; swallow to avoid an unhandled error event */
    });
    void this.client.connect().catch(() => undefined);
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
