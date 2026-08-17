import { config } from 'dotenv';
import { resolve } from 'node:path';
import { seedDevFixtures } from './dev.seed';

config({ path: resolve(__dirname, '../../../../.env') });
config({ path: resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

seedDevFixtures(connectionString)
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Dev seed failed:', error);
    process.exit(1);
  });
