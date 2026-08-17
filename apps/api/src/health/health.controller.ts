import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { PostgisHealthIndicator } from './indicators/postgis.health';
import { RedisHealthIndicator } from './indicators/redis.health';

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly databaseHealth: DatabaseHealthIndicator,
    private readonly postgisHealth: PostgisHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
  ) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'fuelmap-api',
      version: process.env.APP_VERSION ?? 'dev',
      gitSha: process.env.GIT_SHA ?? undefined,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @HealthCheck()
  getReady() {
    return this.health.check([
      () => this.databaseHealth.isHealthy('database'),
      () => this.postgisHealth.isHealthy('postgis'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }
}
