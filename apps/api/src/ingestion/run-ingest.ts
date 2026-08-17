import {
  parseIngestCliArgs,
  resolveDefaultFixture,
  runIngestCli,
} from './ingest-cli';
import { IngestionService } from '../modules/ingestion/ingestion.service';

const args = process.argv.slice(2);
const providerArg = args.find((a) => a.startsWith('--provider='));
const provider = providerArg?.split('=')[1]?.toLowerCase();

if (
  !provider ||
  ![
    'france',
    'spain',
    'germany',
    'austria',
    'italy',
    'slovenia',
    'croatia',
  ].includes(provider)
) {
  console.error(
    'Usage: pnpm ingest -- --provider=france|spain|germany|austria|italy|slovenia|croatia [--dry-run] [--fixture] [--lat=.. --lon=..] [--sync-mode=full|prices]',
  );
  process.exit(1);
}

const options = parseIngestCliArgs(
  args,
  resolveDefaultFixture(
    provider as
      | 'france'
      | 'spain'
      | 'germany'
      | 'austria'
      | 'italy'
      | 'slovenia'
      | 'croatia',
  ),
);

void runIngestCli(async (service: IngestionService) => {
  if (provider === 'france') {
    return service.ingestFrance(options);
  }
  if (provider === 'germany') {
    return service.ingestGermany(options);
  }
  if (provider === 'austria') {
    return service.ingestAustria(options);
  }
  if (provider === 'italy') {
    return service.ingestItaly(options);
  }
  if (provider === 'slovenia') {
    return service.ingestSlovenia(options);
  }
  if (provider === 'croatia') {
    return service.ingestCroatia(options);
  }
  return service.ingestSpain(options);
}, provider);
