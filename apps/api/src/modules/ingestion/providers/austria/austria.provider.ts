import { readFile } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import type {
  FetchResult,
  IngestionOptions,
} from '../../types/ingestion.types';
import type {
  FuelPriceProvider,
  ProviderNormalizeContext,
  ProviderNormalizeResult,
} from '../fuel-price-provider.interface';
import {
  AUSTRIA_API_FUELS,
  AUSTRIA_PROVIDER_CODE,
  type AustriaApiFuel,
} from './austria.constants';
import { AustriaSpritClient } from './austria.client';
import { AustriaProviderConfigurationError } from './austria.errors';
import { austriaGasStationListSchema } from './austria.parser';
import { normalizeAustriaRecords } from './austria.normalizer';

@Injectable()
export class AustriaFuelPriceProvider implements FuelPriceProvider {
  readonly code = AUSTRIA_PROVIDER_CODE;
  readonly observationDedupStrategy = 'price-change-only' as const;

  private readonly logger = new Logger(AustriaFuelPriceProvider.name);

  constructor(private readonly client: AustriaSpritClient) {}

  async fetch(options: IngestionOptions = {}): Promise<FetchResult> {
    if (options.fixturePath) {
      return this.fetchFixture(options.fixturePath);
    }

    const location = options.location;
    if (!location) {
      throw new AustriaProviderConfigurationError(
        'Austria provider requires location (lat/lon) for live fetch or --fixture for offline mode.',
      );
    }

    const fuelTypes = this.resolveFuelTypes(options.austriaFuelTypes);
    const records: unknown[] = [];
    let downloadBytes = 0;
    const resourceUrls: string[] = [];
    const metadata: Record<string, unknown> = {
      format: 'json-location-query',
      lat: location.lat,
      lon: location.lon,
      fuelTypes,
      queryModel: 'location-cheapest-subset',
    };

    for (const fuelType of fuelTypes) {
      this.logger.log(
        `Fetching Austria ${fuelType} near ${location.lat},${location.lon}`,
      );
      const result = await this.client.fetchByLocation({
        lat: location.lat,
        lon: location.lon,
        fuelType,
      });
      records.push(...result.records);
      downloadBytes += result.downloadBytes;
      resourceUrls.push(result.resourceUrl);
    }

    return {
      records,
      downloadBytes,
      resourceUrl: resourceUrls.join(';'),
      metadata: {
        ...metadata,
        resourceUrls,
        recordsMerged: records.length,
      },
    };
  }

  normalize(
    rawRecords: unknown[],
    context: ProviderNormalizeContext,
  ): ProviderNormalizeResult {
    return normalizeAustriaRecords(rawRecords, context);
  }

  private async fetchFixture(fixturePath: string): Promise<FetchResult> {
    const content = await readFile(fixturePath, 'utf-8');
    const parsed = austriaGasStationListSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      throw new AustriaProviderConfigurationError(
        'Invalid Austria fixture file',
      );
    }

    return {
      records: parsed.data,
      downloadBytes: Buffer.byteLength(content, 'utf-8'),
      resourceUrl: fixturePath,
      metadata: {
        format: 'json-fixture',
        stationCount: parsed.data.length,
      },
    };
  }

  private resolveFuelTypes(requested?: AustriaApiFuel[]): AustriaApiFuel[] {
    if (requested && requested.length > 0) {
      return requested;
    }
    return [...AUSTRIA_API_FUELS];
  }
}
