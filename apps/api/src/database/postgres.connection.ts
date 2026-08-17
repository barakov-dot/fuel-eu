import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

@Injectable()
export class PostgresConnection implements OnModuleDestroy {
  readonly client: postgres.Sql;
  readonly db: PostgresJsDatabase<typeof schema>;

  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('DATABASE_URL');
    this.client = postgres(connectionString, { max: 5 });
    this.db = drizzle(this.client, { schema });
  }

  async onModuleDestroy() {
    await this.client.end({ timeout: 5 });
  }
}
