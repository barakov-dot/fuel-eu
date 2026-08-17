import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DATABASE_CLIENT } from './database.constants';
import { PostgresConnection } from './postgres.connection';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    PostgresConnection,
    {
      provide: DATABASE_CLIENT,
      inject: [PostgresConnection],
      useFactory: (connection: PostgresConnection) => connection.db,
    },
  ],
  exports: [DATABASE_CLIENT, PostgresConnection],
})
export class DatabaseModule {}
