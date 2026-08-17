export type IngestionRunStatus =
  'running' | 'succeeded' | 'partially_succeeded' | 'failed';

export interface IngestionStats {
  recordsFetched: number;
  stationsCreated: number;
  stationsUpdated: number;
  mappingsCreated: number;
  priceObservationsCreated: number;
  recordsSkipped: number;
  errorsCount: number;
}

export type IngestionSyncMode = 'full' | 'prices';

export interface IngestionLocation {
  lat: number;
  lon: number;
}

export interface IngestionOptions {
  dryRun?: boolean;
  fixturePath?: string;
  /** Germany: full grid discovery vs prices.php refresh for known station IDs. */
  syncMode?: IngestionSyncMode;
  /** Populated by IngestionService for Germany price-only sync. */
  knownStationIds?: string[];
  /** Austria on-demand location query (required for live Austria fetch). */
  location?: IngestionLocation;
  /** Austria: limit API calls to specific fuel codes (DIE/SUP). */
  austriaFuelTypes?: Array<'DIE' | 'SUP'>;
}

export interface IngestionResult extends IngestionStats {
  runId: string;
  status: IngestionRunStatus;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export type PriceServiceMode = 'self' | 'served' | 'unknown';

export interface NormalizedFuelPrice {
  externalFuelName: string;
  fuelTypeId: string;
  price: string;
  observedAt: Date;
  serviceMode?: PriceServiceMode;
}

export interface NormalizedStationRecord {
  externalStationId: string;
  lon?: number;
  lat?: number;
  /** When true, only price observations are written for an existing mapping. */
  priceUpdateOnly?: boolean;
  addressLine?: string;
  postalCode?: string;
  city?: string;
  brand?: string;
  name?: string;
  rawMetadata?: Record<string, unknown>;
  fuelPrices: NormalizedFuelPrice[];
}

export interface FetchResult {
  records: unknown[];
  downloadBytes: number;
  resourceUrl: string;
  metadata: Record<string, unknown>;
}
