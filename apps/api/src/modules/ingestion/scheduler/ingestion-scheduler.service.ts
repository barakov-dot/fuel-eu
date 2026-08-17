import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { IngestionService } from '../ingestion.service';
import { FRANCE_PROVIDER_CODE } from '../providers/france/france.constants';
import { SPAIN_PROVIDER_CODE } from '../providers/spain/spain.constants';
import { GERMANY_PROVIDER_CODE } from '../providers/germany/germany.constants';
import {
  ITALY_DEFAULT_INGEST_CRON,
  ITALY_PROVIDER_CODE,
} from '../providers/italy/italy.constants';
import {
  SLOVENIA_DEFAULT_INGEST_CRON,
  SLOVENIA_PROVIDER_CODE,
} from '../providers/slovenia/slovenia.constants';
import {
  CROATIA_DEFAULT_INGEST_CRON,
  CROATIA_PROVIDER_CODE,
} from '../providers/croatia/croatia.constants';

const DEFAULT_CRON = '*/10 * * * *';
const DEFAULT_GERMANY_STATIONS_CRON = '0 2 * * 0';
const DEFAULT_GERMANY_PRICES_CRON = '0 3 * * *';
const DEFAULT_ITALY_CRON = ITALY_DEFAULT_INGEST_CRON;
const DEFAULT_SLOVENIA_CRON = SLOVENIA_DEFAULT_INGEST_CRON;
const DEFAULT_CROATIA_CRON = CROATIA_DEFAULT_INGEST_CRON;

@Injectable()
export class IngestionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(IngestionSchedulerService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly ingestionService: IngestionService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const enabled =
      this.configService.get<string>('INGESTION_SCHEDULER_ENABLED') === 'true';

    if (!enabled) {
      this.logger.log('Ingestion scheduler disabled');
      return;
    }

    this.registerProviderJob(
      'france-ingest',
      this.configService.get<string>('FRANCE_INGEST_CRON') ?? DEFAULT_CRON,
      () => this.ingestionService.ingestFrance(),
      FRANCE_PROVIDER_CODE,
    );

    this.registerProviderJob(
      'spain-ingest',
      this.configService.get<string>('SPAIN_INGEST_CRON') ?? DEFAULT_CRON,
      () => this.ingestionService.ingestSpain(),
      SPAIN_PROVIDER_CODE,
    );

    this.registerProviderJob(
      'italy-ingest',
      this.configService.get<string>('ITALY_INGEST_CRON') ?? DEFAULT_ITALY_CRON,
      () => this.ingestionService.ingestItaly(),
      ITALY_PROVIDER_CODE,
    );

    this.registerProviderJob(
      'slovenia-ingest',
      this.configService.get<string>('SLOVENIA_INGEST_CRON') ??
        DEFAULT_SLOVENIA_CRON,
      () => this.ingestionService.ingestSlovenia(),
      SLOVENIA_PROVIDER_CODE,
    );

    this.registerProviderJob(
      'croatia-ingest',
      this.configService.get<string>('CROATIA_INGEST_CRON') ??
        DEFAULT_CROATIA_CRON,
      () => this.ingestionService.ingestCroatia(),
      CROATIA_PROVIDER_CODE,
    );

    if (this.ingestionService.isProviderConfigured(GERMANY_PROVIDER_CODE)) {
      this.registerProviderJob(
        'germany-stations-ingest',
        this.configService.get<string>('GERMANY_STATIONS_INGEST_CRON') ??
          DEFAULT_GERMANY_STATIONS_CRON,
        () => this.ingestionService.ingestGermanyStations(),
        `${GERMANY_PROVIDER_CODE}:stations`,
      );

      this.registerProviderJob(
        'germany-prices-ingest',
        this.configService.get<string>('GERMANY_PRICES_INGEST_CRON') ??
          DEFAULT_GERMANY_PRICES_CRON,
        () => this.ingestionService.ingestGermanyPrices(),
        `${GERMANY_PROVIDER_CODE}:prices`,
      );
    } else {
      this.logger.warn(
        'Germany ingestion jobs not registered: TANKERKOENIG_API_KEY missing',
      );
    }

    this.logger.log('Ingestion scheduler enabled (cron timezone: UTC)');

    if (this.configService.get<string>('INGESTION_RUN_ON_STARTUP') === 'true') {
      this.logger.log('Running configured startup ingestion jobs');
      void this.safeRun(FRANCE_PROVIDER_CODE, () =>
        this.ingestionService.ingestFrance(),
      );
      void this.safeRun(SPAIN_PROVIDER_CODE, () =>
        this.ingestionService.ingestSpain(),
      );
      if (this.ingestionService.isProviderConfigured(GERMANY_PROVIDER_CODE)) {
        void this.safeRun(`${GERMANY_PROVIDER_CODE}:stations`, () =>
          this.ingestionService.ingestGermanyStations(),
        );
      }
    }
  }

  isEnabled(): boolean {
    return (
      this.configService.get<string>('INGESTION_SCHEDULER_ENABLED') === 'true'
    );
  }

  private registerProviderJob(
    jobName: string,
    cronExpression: string,
    handler: () => Promise<unknown>,
    providerCode: string,
  ): void {
    try {
      const job = new CronJob(
        cronExpression,
        () => {
          void this.safeRun(providerCode, handler);
        },
        null,
        true,
        'UTC',
      );
      this.schedulerRegistry.addCronJob(jobName, job);
      this.logger.log(
        `Registered ${jobName} with cron "${cronExpression}" (UTC)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to register ${jobName} cron "${cronExpression}": ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async safeRun(
    providerCode: string,
    handler: () => Promise<unknown>,
  ): Promise<void> {
    try {
      const result = await handler();
      if (result && typeof result === 'object' && 'status' in result) {
        this.logger.log(
          `${providerCode} scheduled run finished: ${(result as { status: string }).status}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `${providerCode} scheduled run failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
