import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from '../config/validate-env';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate,
    }),
    DatabaseModule,
    RedisModule,
  ],
  exports: [ConfigModule, DatabaseModule, RedisModule],
})
export class ApplicationCoreModule {}
