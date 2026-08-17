import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { IngestionSchedulerService } from './ingestion-scheduler.service';
import { IngestionService } from '../ingestion.service';

describe('IngestionSchedulerService', () => {
  let scheduler: IngestionSchedulerService;
  let moduleRef: TestingModule;
  let ingestionService: {
    ingestFrance: jest.Mock;
    ingestSpain: jest.Mock;
    ingestGermanyStations: jest.Mock;
    ingestGermanyPrices: jest.Mock;
    isProviderConfigured: jest.Mock;
  };

  beforeEach(async () => {
    ingestionService = {
      ingestFrance: jest.fn().mockResolvedValue({ status: 'succeeded' }),
      ingestSpain: jest.fn().mockResolvedValue({ status: 'succeeded' }),
      ingestGermanyStations: jest
        .fn()
        .mockResolvedValue({ status: 'succeeded' }),
      ingestGermanyPrices: jest.fn().mockResolvedValue({ status: 'succeeded' }),
      isProviderConfigured: jest.fn().mockReturnValue(false),
    };

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              INGESTION_SCHEDULER_ENABLED: 'false',
              INGESTION_RUN_ON_STARTUP: 'false',
            }),
          ],
        }),
        ScheduleModule.forRoot(),
      ],
      providers: [
        IngestionSchedulerService,
        {
          provide: IngestionService,
          useValue: ingestionService,
        },
      ],
    }).compile();

    await moduleRef.init();

    scheduler = moduleRef.get(IngestionSchedulerService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('does nothing when scheduler is disabled', () => {
    expect(ingestionService.ingestFrance).not.toHaveBeenCalled();
    expect(ingestionService.ingestSpain).not.toHaveBeenCalled();
    expect(scheduler.isEnabled()).toBe(false);
  });

  it('isolates provider failures without throwing', async () => {
    ingestionService.ingestFrance.mockRejectedValue(new Error('France failed'));
    ingestionService.ingestSpain.mockResolvedValue({ status: 'succeeded' });

    await expect(
      scheduler.safeRun('FR_GOV_FUEL_PRICES', async () => {
        await ingestionService.ingestFrance();
      }),
    ).resolves.toBeUndefined();

    await expect(
      scheduler.safeRun('ES_MITECO_FUEL_PRICES', async () => {
        await ingestionService.ingestSpain();
      }),
    ).resolves.toBeUndefined();
  });
});

describe('IngestionSchedulerService enabled', () => {
  it('registers cron jobs when enabled', async () => {
    const ingestionService = {
      ingestFrance: jest.fn().mockResolvedValue({ status: 'succeeded' }),
      ingestSpain: jest.fn().mockResolvedValue({ status: 'succeeded' }),
      ingestGermanyStations: jest
        .fn()
        .mockResolvedValue({ status: 'succeeded' }),
      ingestGermanyPrices: jest.fn().mockResolvedValue({ status: 'succeeded' }),
      isProviderConfigured: jest.fn().mockReturnValue(true),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              INGESTION_SCHEDULER_ENABLED: 'true',
              INGESTION_RUN_ON_STARTUP: 'false',
              FRANCE_INGEST_CRON: '*/10 * * * *',
              SPAIN_INGEST_CRON: '*/10 * * * *',
              GERMANY_STATIONS_INGEST_CRON: '0 2 * * 0',
              GERMANY_PRICES_INGEST_CRON: '0 3 * * *',
            }),
          ],
        }),
        ScheduleModule.forRoot(),
      ],
      providers: [
        IngestionSchedulerService,
        {
          provide: IngestionService,
          useValue: ingestionService,
        },
      ],
    }).compile();

    await moduleRef.init();

    const scheduler = moduleRef.get(IngestionSchedulerService);
    const registry = moduleRef.get(SchedulerRegistry);

    expect(scheduler.isEnabled()).toBe(true);
    expect(registry.doesExist('cron', 'france-ingest')).toBe(true);
    expect(registry.doesExist('cron', 'spain-ingest')).toBe(true);
    expect(registry.doesExist('cron', 'germany-stations-ingest')).toBe(true);
    expect(registry.doesExist('cron', 'germany-prices-ingest')).toBe(true);
    expect(ingestionService.ingestFrance).not.toHaveBeenCalled();

    registry.getCronJob('france-ingest').stop();
    registry.getCronJob('spain-ingest').stop();
    void registry.getCronJob('germany-stations-ingest').stop();
    void registry.getCronJob('germany-prices-ingest').stop();
    await moduleRef.close();
  });
});
