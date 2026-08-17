import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GeocodingProviderException,
  GeocodingRateLimitedException,
  GeocodingTimeoutException,
  GeocodingUnavailableException,
} from '../../geocoding.errors';
import type {
  GeocodingProvider,
  GeocodingResult,
  GeocodingSearchRequest,
  ReverseGeocodingRequest,
  ReverseGeocodingResult,
} from '../../geocoding-provider.interface';
import {
  DEFAULT_NOMINATIM_BASE_URL,
  DEFAULT_NOMINATIM_TIMEOUT_MS,
} from '../../geocoding.constants';
import {
  buildUserAgent,
  buildViewbox,
  isAllowedBaseUrl,
  normalizeNominatimReverseResult,
  normalizeNominatimSearchResult,
} from './nominatim.mapper';
import {
  nominatimReverseErrorSchema,
  nominatimReverseResultSchema,
  nominatimSearchResponseSchema,
} from './nominatim.schemas';
import type {
  NominatimReverseResult,
  NominatimSearchResult,
} from './nominatim.types';

const MAX_RESPONSE_BYTES = 512 * 1024;

@Injectable()
export class NominatimGeocodingProvider implements GeocodingProvider {
  readonly name = 'nominatim';

  constructor(private readonly configService: ConfigService) {}

  async search(request: GeocodingSearchRequest): Promise<GeocodingResult[]> {
    const baseUrl = this.getBaseUrl();
    const params = new URLSearchParams({
      q: request.query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(request.limit ?? 5),
    });

    if (request.countryCodes?.length) {
      params.set(
        'countrycodes',
        request.countryCodes.map((code) => code.toLowerCase()).join(','),
      );
    }

    if (request.biasLocation) {
      params.set('viewbox', buildViewbox(request.biasLocation));
    }

    const url = `${baseUrl}/search?${params.toString()}`;
    const data = await this.fetchJson(url, request.language);
    const parsed = nominatimSearchResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new GeocodingProviderException(
        'Geocoding provider returned malformed search results',
      );
    }

    return parsed.data
      .map((item) =>
        normalizeNominatimSearchResult(item as NominatimSearchResult),
      )
      .filter((item): item is GeocodingResult => item !== null);
  }

  async reverse(
    request: ReverseGeocodingRequest,
  ): Promise<ReverseGeocodingResult | null> {
    const baseUrl = this.getBaseUrl();
    const params = new URLSearchParams({
      lat: String(request.lat),
      lon: String(request.lon),
      format: 'jsonv2',
      addressdetails: '1',
    });

    const url = `${baseUrl}/reverse?${params.toString()}`;
    const data = await this.fetchJson(url, request.language);

    const errorParsed = nominatimReverseErrorSchema.safeParse(data);
    if (errorParsed.success) {
      return null;
    }

    const parsed = nominatimReverseResultSchema.safeParse(data);
    if (!parsed.success) {
      throw new GeocodingProviderException(
        'Geocoding provider returned malformed reverse result',
      );
    }

    return normalizeNominatimReverseResult(
      parsed.data as NominatimReverseResult,
    );
  }

  private getBaseUrl(): string {
    const configured =
      this.configService.get<string>('NOMINATIM_BASE_URL') ??
      DEFAULT_NOMINATIM_BASE_URL;
    const baseUrl = configured.replace(/\/$/, '');

    if (!isAllowedBaseUrl(baseUrl)) {
      throw new GeocodingUnavailableException();
    }

    return baseUrl;
  }

  private async fetchJson(url: string, language?: string): Promise<unknown> {
    const timeoutMs = Number(
      this.configService.get<string>('NOMINATIM_TIMEOUT_MS') ??
        DEFAULT_NOMINATIM_TIMEOUT_MS,
    );
    const contactEmail = this.configService.get<string>(
      'NOMINATIM_CONTACT_EMAIL',
    );
    const userAgent = buildUserAgent(contactEmail);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'User-Agent': userAgent,
        Accept: 'application/json',
      };
      if (language) {
        headers['Accept-Language'] = language;
      }

      const response = await fetch(url, {
        signal: controller.signal,
        headers,
      });

      if (response.status === 429) {
        throw new GeocodingRateLimitedException();
      }

      if (!response.ok) {
        throw new GeocodingProviderException(
          'Geocoding provider request failed',
          response.status >= 500 ? 502 : 400,
        );
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_RESPONSE_BYTES) {
        throw new GeocodingProviderException(
          'Geocoding provider response too large',
        );
      }

      return JSON.parse(new TextDecoder('utf-8').decode(buffer)) as unknown;
    } catch (error) {
      if (error instanceof GeocodingRateLimitedException) {
        throw error;
      }
      if (error instanceof GeocodingProviderException) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GeocodingTimeoutException();
      }
      throw new GeocodingProviderException(
        'Geocoding provider network failure',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
