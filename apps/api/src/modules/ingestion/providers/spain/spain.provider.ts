import { readFile } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpFetchError, fetchJsonWithRetry } from '../../http/http-client';
import type {
  FetchResult,
  IngestionOptions,
} from '../../types/ingestion.types';
import type {
  FuelPriceProvider,
  ProviderNormalizeContext,
  ProviderNormalizeResult,
} from '../fuel-price-provider.interface';
import { SPAIN_DEFAULT_API_URL, SPAIN_PROVIDER_CODE } from './spain.constants';
import { parseSpainFeedTimestamp, parseSpainResponse } from './spain.parser';
import { normalizeSpainRecords } from './spain.normalizer';

@Injectable()
export class SpainFuelPriceProvider implements FuelPriceProvider {
  readonly code = SPAIN_PROVIDER_CODE;
  readonly observationDedupStrategy = 'price-change-only' as const;

  private readonly logger = new Logger(SpainFuelPriceProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async fetch(options: IngestionOptions = {}): Promise<FetchResult> {
    if (options.fixturePath) {
      return this.fetchFixture(options.fixturePath);
    }

    const apiUrl =
      this.configService.get<string>('SPAIN_FUEL_API_URL') ??
      SPAIN_DEFAULT_API_URL;

    this.logger.log(`Fetching Spain feed from ${apiUrl}`);

    const { data, bytes } = await fetchJsonWithRetry<unknown>(apiUrl, {
      timeoutMs: 180_000,
      retries: 3,
    });

    return this.buildFetchResult(data, bytes, apiUrl);
  }

  normalize(
    rawRecords: unknown[],
    context: ProviderNormalizeContext,
  ): ProviderNormalizeResult {
    const feedTimestampRaw = context.providerMetadata?.feedTimestamp;
    const feedObservedAt =
      typeof feedTimestampRaw === 'string' ? new Date(feedTimestampRaw) : null;

    if (!feedObservedAt || Number.isNaN(feedObservedAt.getTime())) {
      return {
        stations: [],
        skipped: rawRecords.length,
        errors: [
          {
            errorCode: 'INVALID_TIMESTAMP',
            message: 'Missing or invalid Spain feed timestamp in metadata',
          },
        ],
      };
    }

    return normalizeSpainRecords(rawRecords, context, feedObservedAt);
  }

  private buildFetchResult(
    data: unknown,
    bytes: number,
    resourceUrl: string,
    format: string = 'json',
  ): FetchResult {
    const parsed = parseSpainResponse(data);
    if (!parsed.ok) {
      throw new HttpFetchError(
        `Spain feed schema validation failed: ${parsed.message}`,
      );
    }

    const feedTimestamp = parseSpainFeedTimestamp(parsed.response.Fecha);
    if (!feedTimestamp) {
      throw new HttpFetchError(
        `Spain feed timestamp invalid: ${parsed.response.Fecha}`,
      );
    }

    return {
      records: parsed.response.ListaEESSPrecio,
      downloadBytes: bytes,
      resourceUrl,
      metadata: {
        format,
        feedTimestamp: feedTimestamp.toISOString(),
        feedTimestampRaw: parsed.response.Fecha,
        stationCount: parsed.response.ListaEESSPrecio.length,
        resultadoConsulta: parsed.response.ResultadoConsulta,
      },
    };
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
