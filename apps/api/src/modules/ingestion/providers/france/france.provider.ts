import { readFile } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { HttpFetchError, fetchJsonWithRetry } from '../../http/http-client';
import type {
  FetchResult,
  IngestionOptions,
} from '../../types/ingestion.types';
import type { FuelPriceProvider } from '../fuel-price-provider.interface';
import {
  FRANCE_DATA_GOUV_API,
  FRANCE_JSON_RESOURCE_ID,
  FRANCE_PAGE_SIZE,
  FRANCE_PROVIDER_CODE,
  FRANCE_RECORDS_API_BASE,
} from './france.constants';
import { franceRecordsResponseSchema } from './france.parser';
import { normalizeFranceRecords } from './france.normalizer';
import type {
  ProviderNormalizeContext,
  ProviderNormalizeResult,
} from '../fuel-price-provider.interface';

interface DataGouvDataset {
  resources?: Array<{
    id: string;
    format?: string;
    title?: string;
    url?: string;
  }>;
}

@Injectable()
export class FranceFuelPriceProvider implements FuelPriceProvider {
  readonly code = FRANCE_PROVIDER_CODE;
  private readonly logger = new Logger(FranceFuelPriceProvider.name);

  async fetch(options: IngestionOptions = {}): Promise<FetchResult> {
    if (options.fixturePath) {
      return this.fetchFixture(options.fixturePath);
    }

    const resourceUrl = await this.resolveResourceUrl();
    const records: unknown[] = [];
    let offset = 0;
    let totalCount = 0;
    let downloadBytes = 0;

    do {
      const pageUrl = `${resourceUrl}?limit=${FRANCE_PAGE_SIZE}&offset=${offset}`;
      const { data, bytes } = await fetchJsonWithRetry<{
        total_count: number;
        results: unknown[];
      }>(pageUrl);

      const parsed = franceRecordsResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new HttpFetchError('France feed schema validation failed');
      }

      totalCount = parsed.data.total_count;
      records.push(...parsed.data.results);
      downloadBytes += bytes;
      offset += FRANCE_PAGE_SIZE;
    } while (offset < totalCount);

    return {
      records,
      downloadBytes,
      resourceUrl,
      metadata: {
        totalCount,
        pageSize: FRANCE_PAGE_SIZE,
        format: 'json',
        dataset: 'prix-des-carburants-en-france-flux-instantane-v2',
      },
    };
  }

  normalize(
    rawRecords: unknown[],
    context: ProviderNormalizeContext,
  ): ProviderNormalizeResult {
    return normalizeFranceRecords(rawRecords, context);
  }

  async resolveResourceUrl(): Promise<string> {
    try {
      const { data } = await fetchJsonWithRetry<DataGouvDataset>(
        FRANCE_DATA_GOUV_API,
        { timeoutMs: 30_000, retries: 2 },
      );

      const jsonResource = data.resources?.find(
        (r) =>
          r.id === FRANCE_JSON_RESOURCE_ID ||
          r.format?.toLowerCase() === 'json',
      );

      if (jsonResource?.url?.includes('data.economie.gouv.fr')) {
        return FRANCE_RECORDS_API_BASE;
      }
    } catch (error) {
      this.logger.warn(
        `data.gouv.fr metadata lookup failed, using default records API: ${error instanceof Error ? error.message : error}`,
      );
    }

    return FRANCE_RECORDS_API_BASE;
  }

  private async fetchFixture(fixturePath: string): Promise<FetchResult> {
    const content = await readFile(fixturePath, 'utf-8');
    const parsed = franceRecordsResponseSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      throw new HttpFetchError('Invalid France fixture file');
    }

    return {
      records: parsed.data.results,
      downloadBytes: Buffer.byteLength(content, 'utf-8'),
      resourceUrl: fixturePath,
      metadata: {
        totalCount: parsed.data.total_count,
        format: 'json-fixture',
      },
    };
  }
}
