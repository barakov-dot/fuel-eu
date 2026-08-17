import {
  parseIngestCliArgs,
  resolveDefaultFixture,
  runIngestCli,
} from './ingest-cli';

const options = parseIngestCliArgs(
  process.argv.slice(2),
  resolveDefaultFixture('austria'),
);

void runIngestCli((service) => service.ingestAustria(options), 'Austria');
