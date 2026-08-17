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
import { CROATIA_DATA_URL, CROATIA_PROVIDER_CODE } from './croatia.constants';
import { normalizeCroatiaRecords } from './croatia.normalizer';
import { parseCroatiaFeed } from './croatia.parser';

@Injectable()
export class CroatiaFuelPriceProvider implements FuelPriceProvider {
  readonly code = CROATIA_PROVIDER_CODE;
  readonly observationDedupStrategy = 'price-change-only' as const;

  private readonly logger = new Logger(CroatiaFuelPriceProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async fetch(options: IngestionOptions = {}): Promise<FetchResult> {
    if (options.fixturePath) {
      return this.fetchFixture(options.fixturePath);
    }

    const dataUrl =
      this.configService.get<string>('CROATIA_DATA_URL') ?? CROATIA_DATA_URL;

    this.logger.log(`Fetching Croatia feed from ${dataUrl}`);

    const { data, bytes } = await fetchJsonWithRetry<unknown>(dataUrl, {
      timeoutMs: 180_000,
      retries: 3,
    });

    return this.buildFetchResult(data, bytes, dataUrl);
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
            message: 'Missing or invalid Croatia fetchedAt in metadata',
          },
        ],
      };
    }

    const gorivoMap = this.parseLookupMap(
      context.providerMetadata?.gorivoToVrstaName,
    );
    const brandMap = this.parseLookupMap(context.providerMetadata?.brandMap);

    return normalizeCroatiaRecords(
      rawRecords,
      context,
      fetchedAt,
      gorivoMap,
      brandMap,
    );
  }

  private buildFetchResult(
    data: unknown,
    bytes: number,
    resourceUrl: string,
    format: string = 'json',
  ): FetchResult {
    const parsed = parseCroatiaFeed(data);
    if (!parsed.ok) {
      throw new HttpFetchError(
        `Croatia feed schema validation failed: ${parsed.message}`,
      );
    }

    const fetchedAt = new Date();

    return {
      records: parsed.feed.stations,
      downloadBytes: bytes,
      resourceUrl,
      metadata: {
        format,
        fetchedAt: fetchedAt.toISOString(),
        stationCount: parsed.feed.stations.length,
        gorivoToVrstaName: Object.fromEntries(parsed.feed.gorivoToVrstaName),
        brandMap: Object.fromEntries(parsed.feed.brandMap),
      },
    };
  }

  private parseLookupMap(raw: unknown): Map<number, string> {
    const map = new Map<number, string>();
    if (raw && typeof raw === 'object') {
      for (const [key, value] of Object.entries(
        raw as Record<string, unknown>,
      )) {
        if (typeof value === 'string') {
          map.set(Number.parseInt(key, 10), value);
        }
      }
    }
    return map;
  }

  private async fetchFixture(fixturePath: string): Promise<FetchResult> {
    const content = await readFile(fixturePath, 'utf-8');
    const data = JSON.parse(content) as unknown;
    return this.buildFetchResult(
      data,
      Buffer.byteLength(content, 'utf-8'),
      fixturePath,
      'json-fixture',
    );
  }
}
