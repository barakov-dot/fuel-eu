import type {
  FetchResult,
  IngestionOptions,
  IngestionResult,
  NormalizedStationRecord,
} from '../types/ingestion.types';

export type ObservationDedupStrategy = 'timestamp-price' | 'price-change-only';

export interface FuelPriceProvider {
  readonly code: string;
  readonly observationDedupStrategy?: ObservationDedupStrategy;

  fetch(options?: IngestionOptions): Promise<FetchResult>;

  normalize(
    rawRecords: unknown[],
    context: ProviderNormalizeContext,
  ): ProviderNormalizeResult;
}

export interface ProviderNormalizeContext {
  dataSourceId: string;
  countryId: string;
  currencyId: string;
  fuelAliasMap: Map<string, string>;
  providerMetadata?: Record<string, unknown>;
}

export interface ProviderNormalizeResult {
  stations: NormalizedStationRecord[];
  skipped: number;
  errors: ProviderRecordError[];
}

export interface ProviderRecordError {
  externalRecordId?: string;
  errorCode: string;
  message: string;
  rawPayload?: Record<string, unknown>;
}

export interface ProviderImportContext extends ProviderNormalizeContext {
  dryRun: boolean;
  runId: string;
  observationDedupStrategy: ObservationDedupStrategy;
}

export interface ProviderImportResult {
  stats: {
    recordsFetched: number;
    stationsCreated: number;
    stationsUpdated: number;
    mappingsCreated: number;
    priceObservationsCreated: number;
    recordsSkipped: number;
    errorsCount: number;
  };
  errors: ProviderRecordError[];
  metadata: Record<string, unknown>;
}

export interface FuelPriceImporter {
  readonly providerCode: string;
  readonly lockKey: number;

  run(options?: IngestionOptions): Promise<IngestionResult>;
}
