import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { loadCliEnv, resolveApiRoot } from '../cli/load-env';

async function main(): Promise<void> {
  loadCliEnv();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const migrationsFolder = resolve(resolveApiRoot(), 'drizzle');
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    console.log(`Running migrations from ${migrationsFolder}`);
    await migrate(db, { migrationsFolder });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end({ timeout: 5 });
  }
}

void main();
