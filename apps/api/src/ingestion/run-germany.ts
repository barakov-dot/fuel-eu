import {
  parseIngestCliArgs,
  resolveDefaultFixture,
  runIngestCli,
} from './ingest-cli';
import { IngestionService } from '../modules/ingestion/ingestion.service';

const args = process.argv.slice(2);
const options = parseIngestCliArgs(args, resolveDefaultFixture('germany'));

void runIngestCli(
  (service: IngestionService) => service.ingestGermany(options),
  'germany',
);
