import { HttpFetchError, fetchJsonWithRetry } from '../../http/http-client';
import {
  GERMANY_DEFAULT_BASE_URL,
  GERMANY_LIST_ENDPOINT,
  GERMANY_MAX_IDS_PER_PRICE_REQUEST,
  GERMANY_MAX_RADIUS_KM,
  GERMANY_PRICES_ENDPOINT,
} from './germany.constants';
import { GermanyRateLimiter } from './germany.rate-limiter';
import {
  parseGermanyListResponse,
  parseGermanyPricesResponse,
} from './germany.parser';
import { generateGermanyDiscoveryGrid } from './germany.grid';

export type GermanySyncMode = 'full' | 'prices';

export interface GermanyFetchMetrics {
  apiRequests: number;
  rateLimitWaitsMs: number;
  chunksTotal: number;
  chunksSucceeded: number;
  chunksFailed: number;
  gridPointsQueried?: number;
  stationIdsRequested?: number;
}

export interface GermanyLiveFetchResult {
  records: unknown[];
  downloadBytes: number;
  resourceUrl: string;
  syncMode: GermanySyncMode;
  fetchedAt: string;
  metrics: GermanyFetchMetrics;
}

export interface GermanyClientOptions {
  apiKey: string;
  baseUrl?: string;
  syncMode?: GermanySyncMode;
  knownStationIds?: string[];
  maxGridPoints?: number;
  rateLimiter?: GermanyRateLimiter;
}

function buildUrl(
  baseUrl: string,
  endpoint: string,
  params: Record<string, string>,
): string {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function fetchGermanyLiveData(
  options: GermanyClientOptions,
): Promise<GermanyLiveFetchResult> {
  const baseUrl = options.baseUrl ?? GERMANY_DEFAULT_BASE_URL;
  const syncMode = options.syncMode ?? 'full';
  const rateLimiter = options.rateLimiter ?? new GermanyRateLimiter();
  const metrics: GermanyFetchMetrics = {
    apiRequests: 0,
    rateLimitWaitsMs: 0,
    chunksTotal: 0,
    chunksSucceeded: 0,
    chunksFailed: 0,
  };

  const fetchedAt = new Date().toISOString();
  let downloadBytes = 0;

  if (syncMode === 'prices') {
    const stationIds = options.knownStationIds ?? [];
    if (stationIds.length === 0) {
      return {
        records: [],
        downloadBytes: 0,
        resourceUrl: `${baseUrl}/${GERMANY_PRICES_ENDPOINT}`,
        syncMode,
        fetchedAt,
        metrics: {
          ...metrics,
          stationIdsRequested: 0,
        },
      };
    }

    const chunks = chunkArray(stationIds, GERMANY_MAX_IDS_PER_PRICE_REQUEST);
    metrics.chunksTotal = chunks.length;
    metrics.stationIdsRequested = stationIds.length;

    const records: unknown[] = [];

    for (const chunk of chunks) {
      const waitMs = await rateLimiter.waitForSlot();
      metrics.rateLimitWaitsMs += waitMs;

      const url = buildUrl(baseUrl, GERMANY_PRICES_ENDPOINT, {
        ids: chunk.join(','),
        apikey: options.apiKey,
      });

      try {
        const { data, bytes } = await fetchJsonWithRetry<unknown>(url, {
          timeoutMs: 60_000,
          retries: 3,
        });
        metrics.apiRequests++;
        downloadBytes += bytes;

        const parsed = parseGermanyPricesResponse(data);
        if (!parsed.ok) {
          metrics.chunksFailed++;
          continue;
        }

        for (const [id, priceRaw] of Object.entries(parsed.prices)) {
          records.push({
            id,
            ...(typeof priceRaw === 'object' && priceRaw !== null
              ? priceRaw
              : {}),
          });
        }
        metrics.chunksSucceeded++;
      } catch (error) {
        metrics.chunksFailed++;
        if (
          error instanceof HttpFetchError &&
          error.statusCode &&
          !error.retryable
        ) {
          throw error;
        }
      }
    }

    return {
      records,
      downloadBytes,
      resourceUrl: `${baseUrl}/${GERMANY_PRICES_ENDPOINT}`,
      syncMode,
      fetchedAt,
      metrics,
    };
  }

  const gridPoints = generateGermanyDiscoveryGrid();
  const limitedGrid =
    options.maxGridPoints && options.maxGridPoints > 0
      ? gridPoints.slice(0, options.maxGridPoints)
      : gridPoints;

  metrics.gridPointsQueried = limitedGrid.length;
  metrics.chunksTotal = limitedGrid.length;

  const stationById = new Map<string, unknown>();

  for (const point of limitedGrid) {
    const waitMs = await rateLimiter.waitForSlot();
    metrics.rateLimitWaitsMs += waitMs;

    const url = buildUrl(baseUrl, GERMANY_LIST_ENDPOINT, {
      lat: String(point.lat),
      lng: String(point.lng),
      rad: String(GERMANY_MAX_RADIUS_KM),
      type: 'all',
      sort: 'dist',
      apikey: options.apiKey,
    });

    try {
      const { data, bytes } = await fetchJsonWithRetry<unknown>(url, {
        timeoutMs: 60_000,
        retries: 3,
      });
      metrics.apiRequests++;
      downloadBytes += bytes;

      const parsed = parseGermanyListResponse(data);
      if (!parsed.ok) {
        metrics.chunksFailed++;
        continue;
      }

      for (const station of parsed.stations) {
        if (
          typeof station === 'object' &&
          station !== null &&
          'id' in station &&
          typeof station.id === 'string'
        ) {
          stationById.set((station as { id: string }).id, station);
        }
      }
      metrics.chunksSucceeded++;
    } catch (error) {
      metrics.chunksFailed++;
      if (
        error instanceof HttpFetchError &&
        error.statusCode &&
        !error.retryable
      ) {
        throw error;
      }
    }
  }

  return {
    records: [...stationById.values()],
    downloadBytes,
    resourceUrl: `${baseUrl}/${GERMANY_LIST_ENDPOINT}`,
    syncMode,
    fetchedAt,
    metrics,
  };
}
