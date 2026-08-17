import { resolve } from 'node:path';
import { parseIngestCliArgs, runIngestCli } from './ingest-cli';
import { IngestionService } from '../modules/ingestion/ingestion.service';

const args = process.argv.slice(2);
const defaultFixture = resolve(__dirname, '../../test/fixtures/italy');
const options = parseIngestCliArgs(args, defaultFixture);

void runIngestCli(
  (service: IngestionService) => service.ingestItaly(options),
  'italy',
);
