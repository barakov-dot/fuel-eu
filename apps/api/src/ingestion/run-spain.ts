import {
  parseIngestCliArgs,
  resolveDefaultFixture,
  runIngestCli,
} from './ingest-cli';

const options = parseIngestCliArgs(
  process.argv.slice(2),
  resolveDefaultFixture('spain'),
);

void runIngestCli((service) => service.ingestSpain(options), 'Spain');
