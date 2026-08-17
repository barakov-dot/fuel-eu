import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AUSTRIA_DEFAULT_BASE_URL,
  AUSTRIA_SEARCH_BY_ADDRESS_PATH,
  type AustriaApiFuel,
} from './austria.constants';
import { AustriaProviderFetchError } from './austria.errors';
import { austriaGasStationListSchema } from './austria.parser';

export interface AustriaLocationQuery {
  lat: number;
  lon: number;
  fuelType: AustriaApiFuel;
  includeClosed?: boolean;
}

export interface AustriaFetchResult {
  records: unknown[];
  downloadBytes: number;
  resourceUrl: string;
  metadata: Record<string, unknown>;
}

@Injectable()
export class AustriaSpritClient {
  constructor(private readonly configService: ConfigService) {}

  getBaseUrl(): string {
    return (
      this.configService.get<string>('AUSTRIA_ECONTROL_BASE_URL') ??
      AUSTRIA_DEFAULT_BASE_URL
    );
  }

  async fetchByLocation(
    query: AustriaLocationQuery,
  ): Promise<AustriaFetchResult> {
    const baseUrl = this.getBaseUrl();
    const url = new URL(`${baseUrl}${AUSTRIA_SEARCH_BY_ADDRESS_PATH}`);
    url.searchParams.set('latitude', String(query.lat));
    url.searchParams.set('longitude', String(query.lon));
    url.searchParams.set('fuelType', query.fuelType);
    url.searchParams.set('includeClosed', String(query.includeClosed ?? false));

    const response = await fetch(url, {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      throw new AustriaProviderFetchError(
        `E-Control Sprit API returned HTTP ${response.status} for ${url.toString()}`,
      );
    }

    const text = await response.text();
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw new AustriaProviderFetchError(
        'E-Control Sprit API returned invalid JSON',
      );
    }

    const parsed = austriaGasStationListSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new AustriaProviderFetchError(
        'E-Control Sprit API response failed schema validation',
      );
    }

    return {
      records: parsed.data,
      downloadBytes: Buffer.byteLength(text, 'utf-8'),
      resourceUrl: url.toString(),
      metadata: {
        format: 'json',
        fuelType: query.fuelType,
        lat: query.lat,
        lon: query.lon,
        stationCount: parsed.data.length,
        pricedStationCount: parsed.data.filter((s) => s.prices.length > 0)
          .length,
      },
    };
  }
}
