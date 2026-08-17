import { readFile } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpFetchError } from '../../http/http-client';
import type {
  FetchResult,
  IngestionOptions,
} from '../../types/ingestion.types';
import type {
  FuelPriceProvider,
  ProviderNormalizeContext,
  ProviderNormalizeResult,
} from '../fuel-price-provider.interface';
import { fetchGermanyLiveData, type GermanySyncMode } from './germany.client';
import {
  GERMANY_DEFAULT_BASE_URL,
  GERMANY_PROVIDER_CODE,
} from './germany.constants';
import { GermanyProviderConfigurationError } from './germany.errors';
import { germanyFixtureSchema } from './germany.parser';
import { normalizeGermanyRecords } from './germany.normalizer';

@Injectable()
export class GermanyFuelPriceProvider implements FuelPriceProvider {
  readonly code = GERMANY_PROVIDER_CODE;
  readonly observationDedupStrategy = 'price-change-only' as const;

  private readonly logger = new Logger(GermanyFuelPriceProvider.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  async fetch(options: IngestionOptions = {}): Promise<FetchResult> {
    if (options.fixturePath) {
      return this.fetchFixture(options.fixturePath);
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new GermanyProviderConfigurationError(
        'TANKERKOENIG_API_KEY is not configured. Register a free key at https://creativecommons.tankerkoenig.de and set TANKERKOENIG_API_KEY in your environment.',
      );
    }

    const syncMode = this.resolveSyncMode(options);
    const baseUrl =
      this.configService.get<string>('TANKERKOENIG_BASE_URL') ??
      GERMANY_DEFAULT_BASE_URL;

    const maxGridPointsRaw = this.configService.get<string>(
      'GERMANY_GRID_MAX_POINTS',
    );
    const maxGridPoints = maxGridPointsRaw
      ? Number.parseInt(maxGridPointsRaw, 10)
      : undefined;

    this.logger.log(
      `Fetching Germany (${syncMode}) from ${baseUrl} (${options.knownStationIds?.length ?? 0} known IDs for price sync)`,
    );

    const live = await fetchGermanyLiveData({
      apiKey,
      baseUrl,
      syncMode,
      knownStationIds: options.knownStationIds,
      maxGridPoints:
        maxGridPoints && Number.isFinite(maxGridPoints) && maxGridPoints > 0
          ? maxGridPoints
          : undefined,
    });

    return {
      records: live.records,
      downloadBytes: live.downloadBytes,
      resourceUrl: live.resourceUrl,
      metadata: {
        format: 'json',
        syncMode: live.syncMode,
        fetchedAt: live.fetchedAt,
        upstreamAuthority: 'Bundeskartellamt MTS-K',
        intermediary: 'Tankerkönig',
        license: 'CC BY 4.0',
        ...live.metrics,
      },
    };
  }

  normalize(
    rawRecords: unknown[],
    context: ProviderNormalizeContext,
  ): ProviderNormalizeResult {
    const fetchedAtRaw = context.providerMetadata?.fetchedAt;
    const syncModeRaw = context.providerMetadata?.syncMode;
    const syncMode: GermanySyncMode =
      syncModeRaw === 'prices' ? 'prices' : 'full';

    const observedAt =
      typeof fetchedAtRaw === 'string' ? new Date(fetchedAtRaw) : new Date();

    if (Number.isNaN(observedAt.getTime())) {
      return {
        stations: [],
        skipped: rawRecords.length,
        errors: [
          {
            errorCode: 'INVALID_TIMESTAMP',
            message: 'Missing or invalid Germany fetch timestamp in metadata',
          },
        ],
      };
    }

    return normalizeGermanyRecords(rawRecords, context, observedAt, syncMode);
  }

  private getApiKey(): string | undefined {
    const key = this.configService.get<string>('TANKERKOENIG_API_KEY')?.trim();
    return key || undefined;
  }

  private resolveSyncMode(options: IngestionOptions): GermanySyncMode {
    if (options.syncMode === 'prices') {
      return 'prices';
    }
    if (options.syncMode === 'full') {
      return 'full';
    }

    const envMode = this.configService
      .get<string>('GERMANY_SYNC_MODE')
      ?.trim()
      .toLowerCase();
    return envMode === 'prices' ? 'prices' : 'full';
  }

  private async fetchFixture(fixturePath: string): Promise<FetchResult> {
    const content = await readFile(fixturePath, 'utf-8');
    const parsedFixture = germanyFixtureSchema.safeParse(JSON.parse(content));
    if (!parsedFixture.success) {
      throw new HttpFetchError('Invalid Germany fixture file');
    }

    const fixture = parsedFixture.data;
    const records =
      fixture.syncMode === 'prices'
        ? (fixture.priceEntries ?? [])
        : (fixture.stations ?? []);

    return {
      records,
      downloadBytes: Buffer.byteLength(content, 'utf-8'),
      resourceUrl: fixturePath,
      metadata: {
        format: 'json-fixture',
        syncMode: fixture.syncMode,
        fetchedAt: fixture.fetchedAt,
        license: fixture.license,
        upstreamData: fixture.data,
      },
    };
  }
}
