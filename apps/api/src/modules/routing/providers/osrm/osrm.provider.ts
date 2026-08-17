import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  fetchJsonWithRetry,
  HttpFetchError,
} from '../../../ingestion/http/http-client';
import {
  RouteNotFoundException,
  RoutingProviderException,
  RoutingTimeoutException,
  RoutingUnavailableException,
} from '../../routing.errors';
import { ROUTING_PROFILE_DRIVING } from '../../routing.constants';
import type {
  RouteBbox,
  RouteRequest,
  RouteResult,
  RoutingProvider,
} from '../../routing-provider.interface';
import { osrmRouteResponseSchema } from './osrm.schemas';
import type { OsrmRouteResponse } from './osrm.types';

function computeBbox(coordinates: [number, number][]): RouteBbox {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const [lon, lat] of coordinates) {
    west = Math.min(west, lon);
    south = Math.min(south, lat);
    east = Math.max(east, lon);
    north = Math.max(north, lat);
  }

  return { west, south, east, north };
}

function formatCoordinates(request: RouteRequest): string {
  const points = [request.origin, ...(request.via ?? []), request.destination];
  return points.map((point) => `${point.lon},${point.lat}`).join(';');
}

@Injectable()
export class OsrmRoutingProvider implements RoutingProvider {
  readonly name = 'osrm';

  constructor(private readonly configService: ConfigService) {}

  async route(request: RouteRequest): Promise<RouteResult> {
    const baseUrl = this.configService
      .get<string>('OSRM_BASE_URL')
      ?.replace(/\/$/, '');
    if (!baseUrl) {
      throw new RoutingUnavailableException();
    }

    const profile = request.profile ?? ROUTING_PROFILE_DRIVING;
    const timeoutMs = Number(
      this.configService.get<string>('OSRM_TIMEOUT_MS') ?? 10_000,
    );
    const coordinates = formatCoordinates(request);
    const url =
      `${baseUrl}/route/v1/${profile}/${coordinates}` +
      '?overview=full&geometries=geojson&steps=false';

    let data: OsrmRouteResponse;
    try {
      const response = await fetchJsonWithRetry<OsrmRouteResponse>(url, {
        timeoutMs,
        maxBytes: 5 * 1024 * 1024,
        retries: 0,
      });
      data = response.data;
    } catch (error) {
      if (error instanceof HttpFetchError) {
        if (error.message.includes('timed out')) {
          throw new RoutingTimeoutException();
        }
        if (
          error.statusCode &&
          error.statusCode >= 400 &&
          error.statusCode < 500
        ) {
          throw new RoutingProviderException(
            'Routing provider rejected the request',
            400,
          );
        }
        throw new RoutingProviderException('Routing provider request failed');
      }
      throw new RoutingProviderException('Routing provider network failure');
    }

    const parsed = osrmRouteResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new RoutingProviderException(
        'Routing provider returned malformed geometry',
      );
    }

    if (parsed.data.code === 'NoRoute' || parsed.data.code === 'NoSegment') {
      throw new RouteNotFoundException();
    }

    if (parsed.data.code !== 'Ok') {
      throw new RoutingProviderException(
        parsed.data.message ?? 'Routing provider returned an error',
      );
    }

    const route = parsed.data.routes?.[0];
    if (!route) {
      throw new RouteNotFoundException();
    }

    return {
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      geometry: route.geometry,
      bbox: computeBbox(route.geometry.coordinates),
    };
  }
}
