import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../database/database.constants';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);

    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      const pong = await this.redis.ping();

      if (pong !== 'PONG') {
        return indicator.down({
          message: `Unexpected Redis response: ${String(pong)}`,
        });
      }

      return indicator.up();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Redis unavailable';
      return indicator.down({ message });
    }
  }
}
