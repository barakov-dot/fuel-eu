import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { REDIS_CLIENT } from '../database/database.constants';
import { RedisConnection } from './redis.connection';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RedisConnection,
    {
      provide: REDIS_CLIENT,
      inject: [RedisConnection],
      useFactory: (connection: RedisConnection) => connection.client,
    },
  ],
  exports: [REDIS_CLIENT, RedisConnection],
})
export class RedisModule {}
