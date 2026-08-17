import {
  parseIngestCliArgs,
  resolveDefaultFixture,
  runIngestCli,
} from './ingest-cli';

const options = parseIngestCliArgs(
  process.argv.slice(2),
  resolveDefaultFixture('france'),
);

void runIngestCli((service) => service.ingestFrance(options), 'France');
