import { readFile } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchJsonWithRetry, HttpFetchError } from '../../http/http-client';
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
  SLOVENIA_FRANCHISE_API_URL,
  SLOVENIA_PROVIDER_CODE,
  SLOVENIA_SEARCH_API_URL,
  SLOVENIA_SEARCH_CENTER,
  SLOVENIA_SEARCH_RADIUS_METERS,
} from './slovenia.constants';
import { normalizeSloveniaRecords } from './slovenia.normalizer';
import {
  parseSloveniaFranchises,
  parseSloveniaSearchResponse,
} from './slovenia.parser';

@Injectable()
export class SloveniaFuelPriceProvider implements FuelPriceProvider {
  readonly code = SLOVENIA_PROVIDER_CODE;
  readonly observationDedupStrategy = 'price-change-only' as const;

  private readonly logger = new Logger(SloveniaFuelPriceProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async fetch(options: IngestionOptions = {}): Promise<FetchResult> {
    if (options.fixturePath) {
      return this.fetchFixture(options.fixturePath);
    }

    const searchUrl =
      this.configService.get<string>('SLOVENIA_SEARCH_API_URL') ??
      SLOVENIA_SEARCH_API_URL;
    const franchiseUrl =
      this.configService.get<string>('SLOVENIA_FRANCHISE_API_URL') ??
      SLOVENIA_FRANCHISE_API_URL;

    this.logger.log(`Fetching Slovenia franchises from ${franchiseUrl}`);
    const { data: franchiseData } = await fetchJsonWithRetry<unknown>(
      franchiseUrl,
      { timeoutMs: 60_000, retries: 3 },
    );
    const franchises = parseSloveniaFranchises(franchiseData);

    const fetchedAt = new Date();
    const allResults: unknown[] = [];
    let nextUrl: string | null =
      `${searchUrl}?position=${SLOVENIA_SEARCH_CENTER.lat},${SLOVENIA_SEARCH_CENTER.lon}&radius=${SLOVENIA_SEARCH_RADIUS_METERS}`;
    let pagesFetched = 0;
    let totalCount = 0;
    let downloadBytes = 0;

    while (nextUrl) {
      pagesFetched++;
      this.logger.log(
        `Fetching Slovenia search page ${pagesFetched}: ${nextUrl}`,
      );
      const { data, bytes } = await fetchJsonWithRetry<unknown>(nextUrl, {
        timeoutMs: 120_000,
        retries: 3,
      });
      downloadBytes += bytes;

      const parsed = parseSloveniaSearchResponse(data);
      if (!parsed.ok) {
        throw new HttpFetchError(
          `Slovenia search schema validation failed: ${parsed.message}`,
        );
      }

      totalCount = parsed.response.count;
      allResults.push(...parsed.response.results);
      nextUrl = parsed.response.next;
    }

    return {
      records: allResults,
      downloadBytes,
      resourceUrl: searchUrl,
      metadata: {
        format: 'json-paginated',
        searchUrl,
        franchiseUrl,
        fetchedAt: fetchedAt.toISOString(),
        totalCount,
        pagesFetched,
        stationCount: allResults.length,
        franchiseCount: franchises.size,
        franchises: Object.fromEntries(franchises),
      },
    };
  }

  normalize(
    rawRecords: unknown[],
    context: ProviderNormalizeContext,
  ): ProviderNormalizeResult {
    const fetchedAtRaw = context.providerMetadata?.fetchedAt;
    const fetchedAt =
      typeof fetchedAtRaw === 'string' ? new Date(fetchedAtRaw) : null;

    if (!fetchedAt || Number.isNaN(fetchedAt.getTime())) {
      return {
        stations: [],
        skipped: rawRecords.length,
        errors: [
          {
            errorCode: 'INVALID_TIMESTAMP',
            message: 'Missing or invalid Slovenia fetchedAt in metadata',
          },
        ],
      };
    }

    const franchisesRaw = context.providerMetadata?.franchises;
    const franchises = new Map<number, string>();
    if (franchisesRaw && typeof franchisesRaw === 'object') {
      for (const [key, value] of Object.entries(
        franchisesRaw as Record<string, unknown>,
      )) {
        if (typeof value === 'string') {
          franchises.set(Number.parseInt(key, 10), value);
        }
      }
    }

    return normalizeSloveniaRecords(rawRecords, context, fetchedAt, franchises);
  }

  private async fetchFixture(fixturePath: string): Promise<FetchResult> {
    const content = await readFile(fixturePath, 'utf-8');
    const data = JSON.parse(content) as {
      results?: unknown[];
      franchises?: Array<{ pk: number; name: string }>;
      fetchedAt?: string;
    };

    const results = data.results ?? [];
    const franchises = new Map<number, string>();
    if (Array.isArray(data.franchises)) {
      for (const f of data.franchises) {
        franchises.set(f.pk, f.name);
      }
    }

    const fetchedAt = data.fetchedAt ?? new Date().toISOString();

    return {
      records: results,
      downloadBytes: Buffer.byteLength(content, 'utf-8'),
      resourceUrl: fixturePath,
      metadata: {
        format: 'json-fixture',
        fetchedAt,
        stationCount: results.length,
        franchiseCount: franchises.size,
        franchises: Object.fromEntries(franchises),
      },
    };
  }
}
