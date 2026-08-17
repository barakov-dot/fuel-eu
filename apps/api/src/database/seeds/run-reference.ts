import { loadCliEnv } from '../../cli/load-env';
import { seedFranceSource } from './france-source.seed';
import { seedAustriaSource } from './austria-source.seed';
import { seedGermanySource } from './germany-source.seed';
import { seedItalySource } from './italy-source.seed';
import { seedSloveniaSource } from './slovenia-source.seed';
import { seedCroatiaSource } from './croatia-source.seed';
import { seedSpainSource } from './spain-source.seed';
import { seedReferenceData } from './reference.seed';

loadCliEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

seedReferenceData(connectionString)
  .then(() => seedFranceSource(connectionString))
  .then(() => seedSpainSource(connectionString))
  .then(() => seedGermanySource(connectionString))
  .then(() => seedAustriaSource(connectionString))
  .then(() => seedItalySource(connectionString))
  .then(() => seedSloveniaSource(connectionString))
  .then(() => seedCroatiaSource(connectionString))
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Reference seed failed:', error);
    process.exit(1);
  });
