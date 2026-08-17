import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  DETOUR_CANDIDATE_COUNT,
  DETOUR_CONCURRENCY,
  REFERENCE_PRICE_SOURCE_ROUTE_MEDIAN,
  REFERENCE_PRICE_SOURCE_USER,
  ROUTING_PROFILE_DRIVING,
  type RouteStationsSort,
} from './routing.constants';
import {
  RouteCorridorService,
  type CorridorCandidateRow,
} from './route-corridor.service';
import { RoutingService } from './routing.service';
import { SavingsCalculatorService } from './savings-calculator.service';
import type {
  RouteCoordinate,
  RouteResult,
} from './routing-provider.interface';
import { mapWithConcurrency } from './utils/concurrency';

export type RouteStationsRequest = {
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  fuelTypeId: string;
  currency: string;
  corridorKm?: number;
  limit?: number;
  refuelLiters: string;
  vehicleConsumptionLPer100Km: string;
  referencePrice?: string;
  maxPrice?: number;
  onlyWithPrice?: boolean;
  maxPriceAgeHours?: number;
  sort?: RouteStationsSort;
  profile?: typeof ROUTING_PROFILE_DRIVING;
};

type DetourCandidate = CorridorCandidateRow & {
  detourFailed?: boolean;
};

type RankedCandidate = {
  station: {
    id: string;
    name: string | null;
    brand: string | null;
    country: { iso2: string; name: string };
    address: {
      addressLine: string | null;
      postalCode: string | null;
      city: string | null;
    };
    location: { lat: number; lon: number };
  };
  fuel: {
    fuelTypeId: string;
    fuelCode: string;
    fuelName: string;
    price: string;
    currency: string;
    observedAt: string;
    ageSeconds: number;
  };
  route: {
    distanceToRouteMeters: number;
    routeProgress: number;
    detourMeters: number | null;
    detourDurationSeconds: number | null;
    detourFailed?: boolean;
  };
  savings: {
    referencePrice: string;
    grossSaving: string;
    extraFuelLiters: string;
    extraDrivingCost: string;
    effectiveSaving: string;
  };
};

function clampDetour(value: number): number {
  return Math.max(0, value);
}

function selectDetourCandidates(
  rows: CorridorCandidateRow[],
  count: number,
): CorridorCandidateRow[] {
  const withPrice = rows.filter((row) => row.price);
  if (withPrice.length === 0) {
    return [];
  }

  const cheapest = [...withPrice]
    .sort(
      (a, b) =>
        new Decimal(a.price).comparedTo(new Decimal(b.price)) ||
        a.distance_to_route_meters - b.distance_to_route_meters,
    )
    .slice(0, Math.ceil(count / 2));

  const closest = [...withPrice]
    .sort(
      (a, b) =>
        a.distance_to_route_meters - b.distance_to_route_meters ||
        new Decimal(a.price).comparedTo(new Decimal(b.price)),
    )
    .slice(0, Math.ceil(count / 2));

  const selected = new Map<string, CorridorCandidateRow>();
  for (const row of [...cheapest, ...closest]) {
    selected.set(row.id, row);
  }

  return [...selected.values()].slice(0, count);
}

@Injectable()
export class RouteStationsService {
  constructor(
    private readonly routingService: RoutingService,
    private readonly corridorService: RouteCorridorService,
    private readonly savingsCalculator: SavingsCalculatorService,
  ) {}

  async findStationsAlongRoute(request: RouteStationsRequest) {
    const corridorKm = request.corridorKm ?? 5;
    const limit = request.limit ?? 20;
    const sort = request.sort ?? 'effective_saving';
    const profile = request.profile ?? ROUTING_PROFILE_DRIVING;
    const onlyWithPrice = request.onlyWithPrice ?? true;

    const baseRoute = await this.routingService.route({
      origin: request.origin,
      destination: request.destination,
      profile,
    });

    const corridorCandidates = await this.corridorService.findCandidates({
      routeGeometry: baseRoute.geometry,
      fuelTypeId: request.fuelTypeId,
      currency: request.currency,
      corridorMeters: corridorKm * 1000,
      maxPrice: request.maxPrice,
      onlyWithPrice,
      maxPriceAgeHours: request.maxPriceAgeHours,
    });

    const pricedCandidates = corridorCandidates.filter((row) => row.price);
    const referencePrice =
      request.referencePrice ??
      this.savingsCalculator.medianPrice(
        pricedCandidates.map((row) => row.price),
      );

    if (!referencePrice) {
      return {
        route: this.mapBaseRoute(baseRoute),
        referencePrice: null,
        referencePriceSource: null,
        items: [],
        meta: {
          corridorKm,
          corridorCandidateCount: corridorCandidates.length,
          exactRoutedCandidateCount: 0,
          currencyFilteringApplied: true,
          limit,
          sort,
        },
      };
    }

    const referencePriceSource = request.referencePrice
      ? REFERENCE_PRICE_SOURCE_USER
      : REFERENCE_PRICE_SOURCE_ROUTE_MEDIAN;

    const detourPool = selectDetourCandidates(
      pricedCandidates,
      DETOUR_CANDIDATE_COUNT,
    );

    const detourResults = await mapWithConcurrency(
      detourPool,
      DETOUR_CONCURRENCY,
      async (candidate) =>
        this.computeDetour(request, candidate, baseRoute, profile),
    );

    const nowMs = Date.now();
    const items: RankedCandidate[] = [];

    for (const candidate of detourResults) {
      if (candidate.detourFailed || candidate.detourMeters === null) {
        continue;
      }

      const savings = this.savingsCalculator.calculate({
        stationPrice: candidate.price,
        referencePrice,
        refuelLiters: request.refuelLiters,
        detourMeters: candidate.detourMeters,
        vehicleConsumptionLPer100Km: request.vehicleConsumptionLPer100Km,
      });

      const observedAtDate =
        candidate.observed_at instanceof Date
          ? candidate.observed_at
          : new Date(candidate.observed_at);

      items.push({
        station: {
          id: candidate.id,
          name: candidate.name,
          brand: candidate.brand,
          country: {
            iso2: candidate.country_iso2,
            name: candidate.country_name_en,
          },
          address: {
            addressLine: candidate.address_line,
            postalCode: candidate.postal_code,
            city: candidate.city,
          },
          location: {
            lat: candidate.lat,
            lon: candidate.lon,
          },
        },
        fuel: {
          fuelTypeId: candidate.fuel_type_id,
          fuelCode: candidate.fuel_code,
          fuelName: candidate.fuel_name_en,
          price: candidate.price,
          currency: candidate.currency_code,
          observedAt: observedAtDate.toISOString(),
          ageSeconds: Math.max(
            0,
            Math.floor((nowMs - observedAtDate.getTime()) / 1000),
          ),
        },
        route: {
          distanceToRouteMeters: Math.round(candidate.distance_to_route_meters),
          routeProgress: Number(candidate.route_progress.toFixed(4)),
          detourMeters: candidate.detourMeters,
          detourDurationSeconds: candidate.detourDurationSeconds,
          detourFailed: candidate.detourFailed,
        },
        savings,
      });
    }

    this.sortItems(items, sort);
    const limitedItems = items.slice(0, limit);

    return {
      route: this.mapBaseRoute(baseRoute),
      referencePrice,
      referencePriceSource,
      items: limitedItems,
      meta: {
        corridorKm,
        corridorCandidateCount: corridorCandidates.length,
        exactRoutedCandidateCount: items.length,
        currencyFilteringApplied: true,
        limit,
        sort,
      },
    };
  }

  private mapBaseRoute(route: RouteResult) {
    return {
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      geometry: route.geometry,
      bbox: route.bbox,
    };
  }

  private async computeDetour(
    request: RouteStationsRequest,
    candidate: CorridorCandidateRow,
    baseRoute: RouteResult,
    profile: typeof ROUTING_PROFILE_DRIVING,
  ): Promise<
    DetourCandidate & {
      detourMeters: number | null;
      detourDurationSeconds: number | null;
    }
  > {
    try {
      const viaRoute = await this.routingService.route(
        {
          origin: request.origin,
          destination: request.destination,
          via: [{ lat: candidate.lat, lon: candidate.lon }],
          profile,
        },
        { useCache: false },
      );

      return {
        ...candidate,
        detourMeters: clampDetour(
          viaRoute.distanceMeters - baseRoute.distanceMeters,
        ),
        detourDurationSeconds: clampDetour(
          viaRoute.durationSeconds - baseRoute.durationSeconds,
        ),
      };
    } catch {
      return {
        ...candidate,
        detourMeters: null,
        detourDurationSeconds: null,
        detourFailed: true,
      };
    }
  }

  private sortItems(items: RankedCandidate[], sort: RouteStationsSort) {
    items.sort((a, b) => {
      switch (sort) {
        case 'price':
          return (
            new Decimal(a.fuel.price).comparedTo(new Decimal(b.fuel.price)) ||
            (a.route.detourMeters ?? 0) - (b.route.detourMeters ?? 0)
          );
        case 'detour':
          return (
            (a.route.detourMeters ?? Number.MAX_SAFE_INTEGER) -
              (b.route.detourMeters ?? Number.MAX_SAFE_INTEGER) ||
            new Decimal(a.fuel.price).comparedTo(new Decimal(b.fuel.price))
          );
        case 'distance_to_route':
          return (
            a.route.distanceToRouteMeters - b.route.distanceToRouteMeters ||
            new Decimal(b.savings.effectiveSaving).comparedTo(
              new Decimal(a.savings.effectiveSaving),
            )
          );
        case 'effective_saving':
        default:
          return (
            new Decimal(b.savings.effectiveSaving).comparedTo(
              new Decimal(a.savings.effectiveSaving),
            ) ||
            (a.route.detourMeters ?? 0) - (b.route.detourMeters ?? 0) ||
            new Decimal(a.fuel.price).comparedTo(new Decimal(b.fuel.price))
          );
      }
    });
  }
}
