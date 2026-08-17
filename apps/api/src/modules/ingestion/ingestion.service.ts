import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IngestionLockService, providerLockKey } from './locking/advisory-lock';
import { IngestionRunService } from './ingestion-run.service';
import { IngestionWriterService } from './ingestion-writer.service';
import { FranceFuelPriceProvider } from './providers/france/france.provider';
import { FRANCE_PROVIDER_CODE } from './providers/france/france.constants';
import { SpainFuelPriceProvider } from './providers/spain/spain.provider';
import { SPAIN_PROVIDER_CODE } from './providers/spain/spain.constants';
import { GermanyFuelPriceProvider } from './providers/germany/germany.provider';
import { GERMANY_PROVIDER_CODE } from './providers/germany/germany.constants';
import { AustriaFuelPriceProvider } from './providers/austria/austria.provider';
import { AUSTRIA_PROVIDER_CODE } from './providers/austria/austria.constants';
import { ItalyFuelPriceProvider } from './providers/italy/italy.provider';
import { ITALY_PROVIDER_CODE } from './providers/italy/italy.constants';
import { SloveniaFuelPriceProvider } from './providers/slovenia/slovenia.provider';
import { SLOVENIA_PROVIDER_CODE } from './providers/slovenia/slovenia.constants';
import { CroatiaFuelPriceProvider } from './providers/croatia/croatia.provider';
import { CROATIA_PROVIDER_CODE } from './providers/croatia/croatia.constants';
import type {
  IngestionOptions,
  IngestionResult,
  IngestionRunStatus,
} from './types/ingestion.types';
import type {
  FuelPriceProvider,
  ObservationDedupStrategy,
} from './providers/fuel-price-provider.interface';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly providers: Map<string, FuelPriceProvider>;

  constructor(
    private readonly franceProvider: FranceFuelPriceProvider,
    private readonly spainProvider: SpainFuelPriceProvider,
    private readonly germanyProvider: GermanyFuelPriceProvider,
    private readonly austriaProvider: AustriaFuelPriceProvider,
    private readonly italyProvider: ItalyFuelPriceProvider,
    private readonly sloveniaProvider: SloveniaFuelPriceProvider,
    private readonly croatiaProvider: CroatiaFuelPriceProvider,
    private readonly runService: IngestionRunService,
    private readonly writerService: IngestionWriterService,
    private readonly lockService: IngestionLockService,
  ) {
    this.providers = new Map<string, FuelPriceProvider>([
      [FRANCE_PROVIDER_CODE, this.franceProvider],
      [SPAIN_PROVIDER_CODE, this.spainProvider],
      [GERMANY_PROVIDER_CODE, this.germanyProvider],
      [AUSTRIA_PROVIDER_CODE, this.austriaProvider],
      [ITALY_PROVIDER_CODE, this.italyProvider],
      [SLOVENIA_PROVIDER_CODE, this.sloveniaProvider],
      [CROATIA_PROVIDER_CODE, this.croatiaProvider],
    ]);
  }

  getProviderCodes(): string[] {
    return [...this.providers.keys()];
  }

  isProviderConfigured(providerCode: string): boolean {
    const provider = this.providers.get(providerCode);
    if (!provider) {
      return false;
    }
    if (
      'isConfigured' in provider &&
      typeof provider.isConfigured === 'function'
    ) {
      return (provider as GermanyFuelPriceProvider).isConfigured();
    }
    return true;
  }

  async ingestFrance(options: IngestionOptions = {}): Promise<IngestionResult> {
    return this.runProvider(FRANCE_PROVIDER_CODE, options);
  }

  async ingestSpain(options: IngestionOptions = {}): Promise<IngestionResult> {
    return this.runProvider(SPAIN_PROVIDER_CODE, options);
  }

  async ingestGermany(
    options: IngestionOptions = {},
  ): Promise<IngestionResult> {
    return this.runProvider(GERMANY_PROVIDER_CODE, options);
  }

  async ingestAustria(
    options: IngestionOptions = {},
  ): Promise<IngestionResult> {
    return this.runProvider(AUSTRIA_PROVIDER_CODE, options);
  }

  async ingestItaly(options: IngestionOptions = {}): Promise<IngestionResult> {
    return this.runProvider(ITALY_PROVIDER_CODE, options);
  }

  async ingestSlovenia(
    options: IngestionOptions = {},
  ): Promise<IngestionResult> {
    return this.runProvider(SLOVENIA_PROVIDER_CODE, options);
  }

  async ingestCroatia(
    options: IngestionOptions = {},
  ): Promise<IngestionResult> {
    return this.runProvider(CROATIA_PROVIDER_CODE, options);
  }

  async ingestGermanyStations(
    options: IngestionOptions = {},
  ): Promise<IngestionResult> {
    return this.runProvider(GERMANY_PROVIDER_CODE, {
      ...options,
      syncMode: 'full',
    });
  }

  async ingestGermanyPrices(
    options: IngestionOptions = {},
  ): Promise<IngestionResult> {
    return this.runProvider(GERMANY_PROVIDER_CODE, {
      ...options,
      syncMode: 'prices',
    });
  }

  async runProvider(
    providerCode: string,
    options: IngestionOptions = {},
  ): Promise<IngestionResult> {
    const provider = this.providers.get(providerCode);
    if (!provider) {
      throw new NotFoundException(`Unknown provider: ${providerCode}`);
    }

    const lockKey = providerLockKey(providerCode);
    const startedMs = Date.now();
    const observationDedupStrategy: ObservationDedupStrategy =
      provider.observationDedupStrategy ?? 'timestamp-price';

    return this.lockService.withProviderLock(
      lockKey,
      providerCode,
      async () => {
        let runId = 'dry-run';

        try {
          const dataSource =
            await this.writerService.loadDataSource(providerCode);
          if (!dataSource) {
            throw new NotFoundException(
              `Data source not registered: ${providerCode}`,
            );
          }

          if (!dataSource.countryId || !dataSource.country) {
            throw new NotFoundException(
              `Country not configured for data source: ${providerCode}`,
            );
          }

          const currency = await this.writerService.loadPrimaryCurrency(
            dataSource.countryId,
          );
          if (!currency) {
            throw new NotFoundException(
              `Primary currency not seeded for country ${dataSource.country.iso2}`,
            );
          }

          const fuelAliasMap = await this.writerService.loadFuelAliasMap(
            dataSource.id,
            dataSource.countryId,
          );

          if (!options.dryRun) {
            const run = await this.runService.startRun(dataSource.id);
            runId = run.id;
          }

          this.logger.log(`${providerCode} ingestion started (run=${runId})`);

          const fetchOptions = await this.buildFetchOptions(
            providerCode,
            dataSource.id,
            options,
          );

          const effectiveFetchOptions =
            providerCode === AUSTRIA_PROVIDER_CODE
              ? {
                  ...fetchOptions,
                  location: options.location ?? fetchOptions.location,
                }
              : fetchOptions;

          const fetchResult = await provider.fetch(effectiveFetchOptions);
          this.logger.log(
            `${providerCode} download complete: ${fetchResult.records.length} records (${fetchResult.downloadBytes} bytes)`,
          );

          const normalizeContext = {
            dataSourceId: dataSource.id,
            countryId: dataSource.countryId,
            currencyId: currency.currencyId,
            fuelAliasMap,
            providerMetadata: fetchResult.metadata,
          };

          const normalized = provider.normalize(
            fetchResult.records,
            normalizeContext,
          );
          this.logger.log(
            `${providerCode} normalization: ${normalized.stations.length} stations, ${normalized.skipped} skipped, ${normalized.errors.length} errors`,
          );

          const importResult = await this.writerService.importStations(
            normalized.stations,
            {
              ...normalizeContext,
              dryRun: options.dryRun ?? false,
              runId,
              observationDedupStrategy,
            },
          );

          const allErrors = [...normalized.errors, ...importResult.errors];
          const stats = {
            recordsFetched: fetchResult.records.length,
            stationsCreated: importResult.stats.stationsCreated,
            stationsUpdated: importResult.stats.stationsUpdated,
            mappingsCreated: importResult.stats.mappingsCreated,
            priceObservationsCreated:
              importResult.stats.priceObservationsCreated,
            recordsSkipped:
              normalized.skipped + importResult.stats.recordsSkipped,
            errorsCount: allErrors.length,
          };

          const status = this.resolveStatus(
            stats.errorsCount,
            fetchResult.records.length,
            normalized.stations.length,
          );

          const metadata = {
            ...fetchResult.metadata,
            resourceUrl: fetchResult.resourceUrl,
            downloadBytes: fetchResult.downloadBytes,
            dryRun: options.dryRun ?? false,
            observationDedupStrategy,
          };

          if (!options.dryRun) {
            await this.runService.recordErrors(runId, allErrors);
            await this.runService.finishRun(runId, status, stats, metadata);
          }

          this.logger.log(`${providerCode} ingestion ${status} (run=${runId})`);

          return {
            runId,
            status,
            durationMs: Date.now() - startedMs,
            metadata,
            ...stats,
          };
        } catch (error) {
          if (!options.dryRun && runId !== 'dry-run') {
            await this.runService.finishRun(
              runId,
              'failed',
              {
                recordsFetched: 0,
                stationsCreated: 0,
                stationsUpdated: 0,
                mappingsCreated: 0,
                priceObservationsCreated: 0,
                recordsSkipped: 0,
                errorsCount: 1,
              },
              {
                error: error instanceof Error ? error.message : String(error),
              },
            );
          }
          throw error;
        }
      },
    );
  }

  private async buildFetchOptions(
    providerCode: string,
    dataSourceId: string,
    options: IngestionOptions,
  ): Promise<IngestionOptions> {
    if (
      providerCode === GERMANY_PROVIDER_CODE &&
      options.syncMode === 'prices' &&
      !options.fixturePath &&
      !options.knownStationIds
    ) {
      const knownStationIds =
        await this.writerService.loadExternalStationIds(dataSourceId);
      return { ...options, knownStationIds };
    }

    return options;
  }

  private resolveStatus(
    errorsCount: number,
    recordsFetched: number,
    normalizedCount: number,
  ): IngestionRunStatus {
    if (recordsFetched === 0) {
      return 'failed';
    }
    if (normalizedCount === 0 && errorsCount > 0) {
      return 'failed';
    }
    if (errorsCount > 0) {
      return 'partially_succeeded';
    }
    return 'succeeded';
  }
}
