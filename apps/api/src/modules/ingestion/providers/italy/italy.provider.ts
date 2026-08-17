import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchWithRetry, HttpFetchError } from '../../http/http-client';
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
  ITALY_PRICES_URL,
  ITALY_PROVIDER_CODE,
  ITALY_STATIONS_URL,
} from './italy.constants';
import {
  normalizeItalyRecords,
  type ItalyNormalizeInput,
} from './italy.normalizer';
import { parseItalyPriceRow, parseItalyStationRow } from './italy.parser';

@Injectable()
export class ItalyFuelPriceProvider implements FuelPriceProvider {
  readonly code = ITALY_PROVIDER_CODE;
  readonly observationDedupStrategy = 'timestamp-price' as const;

  private readonly logger = new Logger(ItalyFuelPriceProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async fetch(options: IngestionOptions = {}): Promise<FetchResult> {
    if (options.fixturePath) {
      return this.fetchFixture(options.fixturePath);
    }

    const stationsUrl =
      this.configService.get<string>('ITALY_STATIONS_URL') ??
      ITALY_STATIONS_URL;
    const pricesUrl =
      this.configService.get<string>('ITALY_PRICES_URL') ?? ITALY_PRICES_URL;

    this.logger.log(`Fetching Italy stations from ${stationsUrl}`);
    this.logger.log(`Fetching Italy prices from ${pricesUrl}`);

    const [stationsResponse, pricesResponse] = await Promise.all([
      fetchWithRetry(stationsUrl, { timeoutMs: 180_000, retries: 3 }),
      fetchWithRetry(pricesUrl, { timeoutMs: 180_000, retries: 3 }),
    ]);

    const stationsParsed = parseItalyStationRow(stationsResponse.body);
    const pricesParsed = parseItalyPriceRow(pricesResponse.body);

    return {
      records: [stationsParsed.rows, pricesParsed.rows],
      downloadBytes: stationsResponse.bytes + pricesResponse.bytes,
      resourceUrl: `${stationsUrl} + ${pricesUrl}`,
      metadata: {
        format: 'csv-pipe',
        stationsUrl,
        pricesUrl,
        stationsDownloadBytes: stationsResponse.bytes,
        pricesDownloadBytes: pricesResponse.bytes,
        stationRows: stationsParsed.rows.length,
        priceRows: pricesParsed.rows.length,
        stationsSkipped: stationsParsed.skipped,
        pricesSkipped: pricesParsed.skipped,
        stationExtractionDate: stationsParsed.extractionDate?.toISOString(),
        priceExtractionDate: pricesParsed.extractionDate?.toISOString(),
      },
    };
  }

  normalize(
    rawRecords: unknown[],
    context: ProviderNormalizeContext,
  ): ProviderNormalizeResult {
    const input = this.toNormalizeInput(rawRecords, context.providerMetadata);
    return normalizeItalyRecords(input, context);
  }

  private toNormalizeInput(
    rawRecords: unknown[],
    metadata?: Record<string, unknown>,
  ): ItalyNormalizeInput {
    if (rawRecords.length !== 2) {
      throw new HttpFetchError(
        'Italy fetch must provide [stations, prices] record arrays',
      );
    }

    const stations = rawRecords[0] as ItalyNormalizeInput['stations'];
    const prices = rawRecords[1] as ItalyNormalizeInput['prices'];
    const priceExtractionRaw = metadata?.priceExtractionDate;
    const priceExtractionDate =
      typeof priceExtractionRaw === 'string'
        ? new Date(priceExtractionRaw)
        : null;

    return {
      stations,
      prices,
      stationsSkipped:
        typeof metadata?.stationsSkipped === 'number'
          ? metadata.stationsSkipped
          : 0,
      pricesSkipped:
        typeof metadata?.pricesSkipped === 'number'
          ? metadata.pricesSkipped
          : 0,
      priceExtractionDate:
        priceExtractionDate && !Number.isNaN(priceExtractionDate.getTime())
          ? priceExtractionDate
          : null,
    };
  }

  private async fetchFixture(fixturePath: string): Promise<FetchResult> {
    const stationsPath = fixturePath.endsWith('stations-small.csv')
      ? fixturePath
      : join(fixturePath, 'stations-small.csv');
    const pricesPath = fixturePath.endsWith('prices-small.csv')
      ? fixturePath
      : join(fixturePath, 'prices-small.csv');

    const [stationsContent, pricesContent] = await Promise.all([
      readFile(stationsPath, 'utf-8'),
      readFile(pricesPath, 'utf-8'),
    ]);

    const stationsParsed = parseItalyStationRow(stationsContent);
    const pricesParsed = parseItalyPriceRow(pricesContent);

    return {
      records: [stationsParsed.rows, pricesParsed.rows],
      downloadBytes:
        Buffer.byteLength(stationsContent, 'utf-8') +
        Buffer.byteLength(pricesContent, 'utf-8'),
      resourceUrl: `${stationsPath} + ${pricesPath}`,
      metadata: {
        format: 'csv-pipe-fixture',
        stationsUrl: stationsPath,
        pricesUrl: pricesPath,
        stationsDownloadBytes: Buffer.byteLength(stationsContent, 'utf-8'),
        pricesDownloadBytes: Buffer.byteLength(pricesContent, 'utf-8'),
        stationRows: stationsParsed.rows.length,
        priceRows: pricesParsed.rows.length,
        stationsSkipped: stationsParsed.skipped,
        pricesSkipped: pricesParsed.skipped,
        stationExtractionDate: stationsParsed.extractionDate?.toISOString(),
        priceExtractionDate: pricesParsed.extractionDate?.toISOString(),
      },
    };
  }
}
