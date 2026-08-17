import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IngestionRunService } from './ingestion-run.service';
import { FRANCE_PROVIDER_CODE } from './providers/france/france.constants';
import { SPAIN_PROVIDER_CODE } from './providers/spain/spain.constants';
import { GERMANY_PROVIDER_CODE } from './providers/germany/germany.constants';
import { AUSTRIA_PROVIDER_CODE } from './providers/austria/austria.constants';
import { ITALY_PROVIDER_CODE } from './providers/italy/italy.constants';
import { SLOVENIA_PROVIDER_CODE } from './providers/slovenia/slovenia.constants';
import { CROATIA_PROVIDER_CODE } from './providers/croatia/croatia.constants';

const INGESTION_SOURCE_CODES = [
  FRANCE_PROVIDER_CODE,
  SPAIN_PROVIDER_CODE,
  GERMANY_PROVIDER_CODE,
  AUSTRIA_PROVIDER_CODE,
  ITALY_PROVIDER_CODE,
  SLOVENIA_PROVIDER_CODE,
  CROATIA_PROVIDER_CODE,
];

@Controller('ingestion')
export class IngestionController {
  constructor(
    private readonly runService: IngestionRunService,
    private readonly configService: ConfigService,
  ) {}

  @Get('status')
  async getStatus() {
    const sources = await this.runService.getActiveSourcesWithLatestRun();

    return {
      schedulerEnabled:
        this.configService.get<string>('INGESTION_SCHEDULER_ENABLED') ===
        'true',
      sources: sources
        .filter((source) => INGESTION_SOURCE_CODES.includes(source.code))
        .map((source) => ({
          code: source.code,
          country: source.country?.iso2 ?? null,
          lastRun: source.ingestionRuns[0]
            ? {
                status: source.ingestionRuns[0].status,
                startedAt: source.ingestionRuns[0].startedAt.toISOString(),
                finishedAt:
                  source.ingestionRuns[0].finishedAt?.toISOString() ?? null,
                recordsFetched: source.ingestionRuns[0].recordsFetched,
                stationsCreated: source.ingestionRuns[0].stationsCreated,
                priceObservationsCreated:
                  source.ingestionRuns[0].priceObservationsCreated,
                errorsCount: source.ingestionRuns[0].errorsCount,
              }
            : null,
        })),
    };
  }
}
