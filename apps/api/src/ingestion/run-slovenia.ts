import { parseIngestCliArgs, runIngestCli } from './ingest-cli';
import { IngestionService } from '../modules/ingestion/ingestion.service';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const defaultFixture = resolve(
  __dirname,
  '../../test/fixtures/slovenia/search-small.json',
);
const options = parseIngestCliArgs(args, defaultFixture);

void runIngestCli(
  (service: IngestionService) => service.ingestSlovenia(options),
  'slovenia',
);
