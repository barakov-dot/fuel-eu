'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  useDictionary,
  useLocale,
} from '@/components/i18n/I18nProvider';
import { FilterBar } from '@/components/filters/FilterBar';
import { FuelSelector } from '@/components/filters/FuelSelector';
import { StationMap } from '@/components/map/StationMapClient';
import {
  RoutePlannerPanel,
  routePointFromGeo,
  routePointFromGeocoding,
  type MapPickMode,
} from '@/components/route/RoutePlannerPanel';
import { PlaceSearch } from '@/components/search/PlaceSearch';
import { RouteResultsPanel } from '@/components/route/RouteResultsPanel';
import { StationList } from '@/components/stations/StationList';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { fetchFuelTypes } from '@/lib/api/fuels';
import { reverseGeocode } from '@/lib/api/geocoding';
import { fetchRouteStations } from '@/lib/api/routing';
import { fetchBboxStations, fetchNearbyStations } from '@/lib/api/stations';
import { ApiError } from '@/lib/api/types';
import type {
  FuelType,
  GeocodingBoundingBox,
  GeocodingResult,
  NearbySort,
  NearbyStation,
  RoutePoint,
  RouteStationsResponse,
} from '@/lib/api/types';
import {
  BBOX_DEBOUNCE_MS,
  BBOX_LIMIT,
  DEFAULT_NEARBY_LIMIT,
  DEFAULT_RADIUS_KM,
  DEFAULT_SORT,
  PARIS_FALLBACK,
} from '@/lib/i18n/config';
import {
  findFuelByCode,
  mergeMapStations,
  type MapStation,
} from '@/lib/stations/helpers';
import { coverageNoticeMessage } from '@/lib/stations/coverage';
import {
  requestCurrentPosition,
  type GeoPosition,
  type GeolocationStatus,
} from '@/lib/geo/location';
import {
  encodeRouteLabel,
  formatCoordinatePair,
  parseCoordinatePair,
  parseLatLonParams,
  parseRouteLabel,
} from '@/lib/geo/route';
import { formatPriceCompact } from '@/lib/format/price';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { t } from '@/lib/i18n/dictionaries';
import styles from './HomeExplorer.module.css';

type ViewMode = 'map' | 'list';

const DEFAULT_REFUEL_LITERS = '45';
const DEFAULT_CONSUMPTION = '7.0';

function mergeRoutePoint(
  coordinates: RoutePoint | null,
  labelFromUrl: string | undefined,
): RoutePoint | null {
  if (!coordinates) {
    return null;
  }
  return {
    lat: coordinates.lat,
    lon: coordinates.lon,
    label: coordinates.label ?? labelFromUrl,
  };
}

function boundingBoxToFitBounds(box: GeocodingBoundingBox) {
  return {
    west: box.west,
    south: box.south,
    east: box.east,
    north: box.north,
  };
}

function locationStatusMessage(
  status: GeolocationStatus,
  usingFallback: boolean,
  dict: Dictionary,
): string {
  if (status === 'requesting') {
    return dict.location.requesting;
  }
  if (status === 'granted' && !usingFallback) {
    return dict.location.usingDevice;
  }
  if (status === 'denied') {
    return dict.location.denied;
  }
  if (status === 'timeout') {
    return dict.location.timeout;
  }
  if (status === 'unavailable') {
    return dict.location.unavailable;
  }
  if (usingFallback) {
    return dict.location.fallbackParis;
  }
  return dict.location.usingDevice;
}

export function HomeExplorer() {
  const dict = useDictionary();
  const locale = useLocale();
  const { state: authState } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [fuelTypesError, setFuelTypesError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeolocationStatus>('requesting');
  const [userLocation, setUserLocation] = useState<GeoPosition | null>(null);
  const [usingFallback, setUsingFallback] = useState(true);
  const [nearbyStations, setNearbyStations] = useState<NearbyStation[]>([]);
  const [bboxStations, setBboxStations] = useState<MapStation[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [coverageNotice, setCoverageNotice] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string>();
  const [fitStationId, setFitStationId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [mapError, setMapError] = useState(false);

  const [routeOrigin, setRouteOrigin] = useState<RoutePoint | null>(null);
  const [routeDestination, setRouteDestination] = useState<RoutePoint | null>(
    null,
  );
  const [mapPickMode, setMapPickMode] = useState<MapPickMode>(null);
  const [routeResults, setRouteResults] = useState<RouteStationsResponse | null>(
    null,
  );
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [refuelLitersOverride, setRefuelLitersOverride] = useState<string | null>(
    null,
  );
  const [vehicleConsumptionOverride, setVehicleConsumptionOverride] = useState<
    string | null
  >(null);
  const [fitRouteKey, setFitRouteKey] = useState<string | null>(null);
  const [fitLocationKey, setFitLocationKey] = useState<string | null>(null);
  const [fitLocationBounds, setFitLocationBounds] = useState<{
    west: number;
    south: number;
    east: number;
    north: number;
  } | null>(null);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState<
    string | null
  >(null);
  const [selectedRouteCandidateId, setSelectedRouteCandidateId] = useState<
    string | undefined
  >();

  const nearbyAbortRef = useRef<AbortController | null>(null);
  const bboxAbortRef = useRef<AbortController | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const bboxDebounceRef = useRef<number | null>(null);
  const nearbyRequestIdRef = useRef(0);
  const bboxRequestIdRef = useRef(0);
  const routeRequestIdRef = useRef(0);
  const autoPlanAttemptedRef = useRef(false);
  const reverseAbortRef = useRef<AbortController | null>(null);

  const savedRefuelLiters =
    authState.status === 'authenticated'
      ? authState.preferences.defaultRefuelLiters
      : null;
  const savedVehicleConsumption =
    authState.status === 'authenticated'
      ? authState.preferences.vehicleConsumptionLPer100Km
      : null;
  const refuelLiters =
    refuelLitersOverride ?? savedRefuelLiters ?? DEFAULT_REFUEL_LITERS;
  const vehicleConsumption =
    vehicleConsumptionOverride ??
    savedVehicleConsumption ??
    DEFAULT_CONSUMPTION;

  const fuelCode = searchParams.get('fuel');
  const radiusKm = Number(searchParams.get('radius') ?? DEFAULT_RADIUS_KM);
  const sort = (searchParams.get('sort') as NearbySort) ?? DEFAULT_SORT;
  const urlLatLon = parseLatLonParams(
    searchParams.get('lat'),
    searchParams.get('lon'),
  );
  const urlFrom = parseCoordinatePair(searchParams.get('from'));
  const urlTo = parseCoordinatePair(searchParams.get('to'));
  const urlFromLabel = parseRouteLabel(searchParams.get('fromLabel'));
  const urlToLabel = parseRouteLabel(searchParams.get('toLabel'));

  const effectiveOrigin = mergeRoutePoint(routeOrigin ?? urlFrom, urlFromLabel);
  const effectiveDestination = mergeRoutePoint(
    routeDestination ?? urlTo,
    urlToLabel,
  );

  const selectedFuel = useMemo(() => {
    if (fuelCode) {
      return findFuelByCode(fuelTypes, fuelCode);
    }
    if (authState.status === 'authenticated') {
      const preferredFuelTypeId = authState.preferences.preferredFuelTypeId;
      if (preferredFuelTypeId) {
        return fuelTypes.find((fuel) => fuel.id === preferredFuelTypeId);
      }
    }
    return undefined;
  }, [fuelTypes, fuelCode, authState]);

  const routeActive = Boolean(effectiveOrigin && effectiveDestination);

  const searchCenter = useMemo(() => {
    if (routeActive && effectiveOrigin) {
      return effectiveOrigin;
    }
    if (urlLatLon) {
      return urlLatLon;
    }
    return userLocation ?? PARIS_FALLBACK;
  }, [routeActive, effectiveOrigin, urlLatLon, userLocation]);

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const syncRouteUrl = useCallback(
    (origin: RoutePoint | null, destination: RoutePoint | null) => {
      setRouteOrigin(origin);
      setRouteDestination(destination);
      updateSearchParams({
        from: origin ? formatCoordinatePair(origin) : null,
        to: destination ? formatCoordinatePair(destination) : null,
        fromLabel: origin ? encodeRouteLabel(origin.label) : null,
        toLabel: destination ? encodeRouteLabel(destination.label) : null,
        lat: null,
        lon: null,
      });
    },
    [updateSearchParams],
  );

  const reverseGeocodePoint = useCallback(
    async (
      point: RoutePoint,
      applyLabel: (next: RoutePoint) => void,
    ): Promise<void> => {
      reverseAbortRef.current?.abort();
      const controller = new AbortController();
      reverseAbortRef.current = controller;

      try {
        const result = await reverseGeocode(
          { lat: point.lat, lon: point.lon, language: locale },
          controller.signal,
        );
        applyLabel({
          lat: point.lat,
          lon: point.lon,
          label: result.displayName,
        });
      } catch {
        // Coordinates remain valid when reverse geocoding fails.
      }
    },
    [locale],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchFuelTypes(controller.signal)
      .then(setFuelTypes)
      .catch((error: unknown) => {
        setFuelTypesError(
          error instanceof ApiError
            ? error.message
            : dict.errors.apiUnavailable,
        );
      });
    return () => controller.abort();
  }, [dict.errors.apiUnavailable]);

  useEffect(() => {
    requestCurrentPosition().then((result) => {
      setGeoStatus(result.status);
      if (result.status === 'granted') {
        setUserLocation(result.position);
        setUsingFallback(false);
      } else {
        setUserLocation(PARIS_FALLBACK);
        setUsingFallback(true);
      }
    });
  }, []);

  const planRoute = useCallback(
    async (
      origin: RoutePoint,
      destination: RoutePoint,
      fuelTypeId: string | undefined,
    ) => {
      if (!fuelTypeId) {
        setRouteError(dict.route.noCandidates);
        return;
      }

      routeAbortRef.current?.abort();
      const controller = new AbortController();
      routeAbortRef.current = controller;
      const requestId = ++routeRequestIdRef.current;

      setRouteLoading(true);
      setRouteError(null);

      try {
        const routeCurrency =
          authState.status === 'authenticated' &&
          authState.preferences.preferredCurrency
            ? authState.preferences.preferredCurrency
            : 'EUR';
        const response = await fetchRouteStations(
          {
            origin,
            destination,
            fuelTypeId,
            currency: routeCurrency,
            corridorKm: 5,
            limit: 20,
            refuelLiters,
            vehicleConsumptionLPer100Km: vehicleConsumption,
            sort: 'effective_saving',
          },
          controller.signal,
        );

        if (requestId !== routeRequestIdRef.current) {
          return;
        }

        setRouteResults(response);
        setFitRouteKey(`${origin.lat},${origin.lon}-${destination.lat},${destination.lon}`);
        setViewMode('list');
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return;
        }
        setRouteResults(null);
        setRouteError(
          error instanceof ApiError
            ? error.message
            : dict.errors.apiUnavailable,
        );
      } finally {
        if (requestId === routeRequestIdRef.current) {
          setRouteLoading(false);
        }
      }
    },
    [
      authState,
      dict.errors.apiUnavailable,
      dict.route.noCandidates,
      refuelLiters,
      vehicleConsumption,
    ],
  );

  useEffect(() => {
    if (autoPlanAttemptedRef.current) {
      return;
    }
    if (!urlFrom || !urlTo || !selectedFuel || routeResults || routeLoading) {
      return;
    }
    autoPlanAttemptedRef.current = true;
    queueMicrotask(() => {
      void planRoute(urlFrom, urlTo, selectedFuel.id);
    });
  }, [urlFrom, urlTo, selectedFuel, routeResults, routeLoading, planRoute]);

  useEffect(() => {
    if (!urlFrom || urlFromLabel) {
      return;
    }
    void reverseGeocodePoint(urlFrom, (next) => {
      setRouteOrigin((current) => current ?? next);
    });
  }, [reverseGeocodePoint, urlFrom, urlFromLabel]);

  useEffect(() => {
    if (!urlTo || urlToLabel) {
      return;
    }
    void reverseGeocodePoint(urlTo, (next) => {
      setRouteDestination((current) => current ?? next);
    });
  }, [reverseGeocodePoint, urlTo, urlToLabel]);

  useEffect(() => {
    if (!searchCenter.lat || !searchCenter.lon) {
      return;
    }

    nearbyAbortRef.current?.abort();
    const controller = new AbortController();
    nearbyAbortRef.current = controller;
    const requestId = ++nearbyRequestIdRef.current;

    queueMicrotask(() => {
      if (requestId === nearbyRequestIdRef.current) {
        setLoadingNearby(true);
        setNearbyError(null);
      }
    });

    const effectiveSort =
      sort === 'price' && selectedFuel ? 'price' : 'distance';

    fetchNearbyStations(
      {
        lat: searchCenter.lat,
        lon: searchCenter.lon,
        radiusKm,
        limit: DEFAULT_NEARBY_LIMIT,
        sort: effectiveSort,
        fuelTypeId: selectedFuel?.id,
        currency: effectiveSort === 'price' ? 'EUR' : undefined,
      },
      controller.signal,
    )
      .then((response) => {
        if (requestId !== nearbyRequestIdRef.current) {
          return;
        }
        setNearbyStations(response.items);
        setCoverageNotice(
          response.meta.coverageNotice
            ? coverageNoticeMessage(
                response.meta.coverageNotice.coverageType,
                response.meta.coverageNotice.limitations,
                dict,
              )
            : null,
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (requestId !== nearbyRequestIdRef.current) {
          return;
        }
        setNearbyError(
          error instanceof ApiError
            ? error.message
            : dict.errors.apiUnavailable,
        );
        setNearbyStations([]);
        setCoverageNotice(null);
      })
      .finally(() => {
        if (requestId === nearbyRequestIdRef.current) {
          setLoadingNearby(false);
        }
      });

    return () => controller.abort();
  }, [
    dict.errors.apiUnavailable,
    radiusKm,
    searchCenter.lat,
    searchCenter.lon,
    selectedFuel,
    sort,
  ]);

  const nearbyMapStations = useMemo<MapStation[]>(
    () =>
      nearbyStations.map((station) => {
        const selectedPrice = selectedFuel
          ? station.prices.find(
              (price) => price.fuelType.id === selectedFuel.id,
            )
          : station.prices[0];

        return {
          id: station.id,
          lat: station.location.lat,
          lon: station.location.lon,
          name: station.name,
          brand: station.brand,
          priceLabel: selectedPrice
            ? formatPriceCompact(
                selectedPrice.price,
                selectedPrice.currency,
                locale,
              )
            : undefined,
        };
      }),
    [locale, nearbyStations, selectedFuel],
  );

  const mapStations = useMemo(
    () => mergeMapStations(nearbyMapStations, bboxStations),
    [bboxStations, nearbyMapStations],
  );

  const handleViewportChange = useCallback(
    (bounds: {
      west: number;
      south: number;
      east: number;
      north: number;
    }) => {
      if (bboxDebounceRef.current) {
        window.clearTimeout(bboxDebounceRef.current);
      }

      bboxDebounceRef.current = window.setTimeout(() => {
        bboxAbortRef.current?.abort();
        const controller = new AbortController();
        bboxAbortRef.current = controller;
        const requestId = ++bboxRequestIdRef.current;

        fetchBboxStations(
          {
            west: bounds.west,
            south: bounds.south,
            east: bounds.east,
            north: bounds.north,
            limit: BBOX_LIMIT,
            fuelTypeId: selectedFuel?.id,
          },
          controller.signal,
        )
          .then((response) => {
            if (requestId !== bboxRequestIdRef.current) {
              return;
            }
            setBboxStations(
              response.items.map((station) => {
                const selectedPrice = selectedFuel
                  ? station.prices.find(
                      (price) => price.fuelType.id === selectedFuel.id,
                    )
                  : station.prices[0];

                return {
                  id: station.id,
                  lat: station.lat,
                  lon: station.lon,
                  name: station.name,
                  brand: station.brand,
                  priceLabel: selectedPrice
                    ? formatPriceCompact(
                        selectedPrice.price,
                        selectedPrice.currency,
                        locale,
                      )
                    : undefined,
                };
              }),
            );
          })
          .catch(() => {
            // bbox failures are non-fatal; nearby list remains primary
          });
      }, BBOX_DEBOUNCE_MS);
    },
    [locale, selectedFuel],
  );

  const handleFuelChange = (fuelTypeId: string | undefined) => {
    const fuel = fuelTypes.find((item) => item.id === fuelTypeId);
    updateSearchParams({
      fuel: fuel?.code ?? null,
      sort: sort === 'price' && !fuel ? 'distance' : sort,
    });
  };

  const handleSortChange = (nextSort: NearbySort) => {
    if (nextSort === 'price' && !selectedFuel) {
      return;
    }
    updateSearchParams({ sort: nextSort === DEFAULT_SORT ? null : nextSort });
  };

  const handleRadiusChange = (nextRadius: number) => {
    updateSearchParams({
      radius: nextRadius === DEFAULT_RADIUS_KM ? null : String(nextRadius),
    });
  };

  const handleCenterStation = (stationId: string) => {
    setSelectedStationId(stationId);
    setFitStationId(stationId);
    setViewMode('map');
  };

  const handleSetOriginFromLocation = () => {
    const location = userLocation ?? PARIS_FALLBACK;
    const point = routePointFromGeo(location);
    syncRouteUrl(point, effectiveDestination);
    setMapPickMode(null);
  };

  const handleMapPick = (point: GeoPosition) => {
    const coordinateLabel = formatCoordinatePair(point);
    if (mapPickMode === 'origin') {
      const nextOrigin: RoutePoint = {
        lat: point.lat,
        lon: point.lon,
        label: coordinateLabel,
      };
      syncRouteUrl(nextOrigin, effectiveDestination);
      void reverseGeocodePoint(nextOrigin, (labeled) => {
        syncRouteUrl(labeled, effectiveDestination);
      });
    } else if (mapPickMode === 'destination') {
      const nextDestination: RoutePoint = {
        lat: point.lat,
        lon: point.lon,
        label: coordinateLabel,
      };
      syncRouteUrl(effectiveOrigin, nextDestination);
      void reverseGeocodePoint(nextDestination, (labeled) => {
        syncRouteUrl(effectiveOrigin, labeled);
      });
    }
    setMapPickMode(null);
  };

  const handleOriginSelect = (result: GeocodingResult) => {
    syncRouteUrl(routePointFromGeocoding(result), effectiveDestination);
    setMapPickMode(null);
  };

  const handleDestinationSelect = (result: GeocodingResult) => {
    syncRouteUrl(effectiveOrigin, routePointFromGeocoding(result));
    setMapPickMode(null);
  };

  const handleMapPlaceSelect = (result: GeocodingResult) => {
    setSelectedLocationLabel(result.displayName);
    setFitLocationBounds(
      result.boundingBox ? boundingBoxToFitBounds(result.boundingBox) : null,
    );
    setFitLocationKey(`${result.id}-${Date.now()}`);
    updateSearchParams({
      lat: String(result.location.lat),
      lon: String(result.location.lon),
      from: null,
      to: null,
      fromLabel: null,
      toLabel: null,
    });
    setRouteOrigin(null);
    setRouteDestination(null);
    setRouteResults(null);
    setViewMode('map');
  };

  const handlePlanRoute = () => {
    if (!effectiveOrigin || !effectiveDestination || !selectedFuel) {
      return;
    }
    syncRouteUrl(effectiveOrigin, effectiveDestination);
    void planRoute(effectiveOrigin, effectiveDestination, selectedFuel.id);
  };

  const handleClearRoute = () => {
    autoPlanAttemptedRef.current = false;
    syncRouteUrl(null, null);
    setRouteResults(null);
    setRouteError(null);
    setSelectedRouteCandidateId(undefined);
    setFitRouteKey(null);
  };

  const handleSelectRouteCandidate = (stationId: string) => {
    setSelectedRouteCandidateId(stationId);
    setSelectedStationId(stationId);
    setFitStationId(stationId);
    setViewMode('map');
  };

  const listHasRouteResults = Boolean(routeResults || routeLoading || routeError);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{dict.app.title}</h1>
          <p className={styles.locationStatus}>
            {locationStatusMessage(geoStatus, usingFallback, dict)}
          </p>
        </div>
        <div className={styles.headerActions}>
          <AccountMenu />
          <LanguageSelector />
        </div>
      </header>

      <section className={styles.filters}>
        <PlaceSearch
          placeholder={dict.geocode.mapPlaceholder}
          selectedLabel={selectedLocationLabel}
          biasLocation={searchCenter}
          onSelect={handleMapPlaceSelect}
          onClear={() => {
            setSelectedLocationLabel(null);
            updateSearchParams({ lat: null, lon: null });
          }}
        />
        {selectedLocationLabel && (
          <p className={styles.locationStatus}>
            {t(dict.geocode.selectedLocation, { value: selectedLocationLabel })}
          </p>
        )}
        {fuelTypesError ? (
          <StatusMessage variant="error">{fuelTypesError}</StatusMessage>
        ) : (
          <FuelSelector
            fuelTypes={fuelTypes}
            selectedFuelTypeId={selectedFuel?.id}
            onChange={handleFuelChange}
          />
        )}
        <FilterBar
          radiusKm={radiusKm}
          sort={sort}
          fuelSelected={Boolean(selectedFuel)}
          onRadiusChange={handleRadiusChange}
          onSortChange={handleSortChange}
        />
        <RoutePlannerPanel
          origin={effectiveOrigin}
          destination={effectiveDestination}
          mapPickMode={mapPickMode}
          searchBiasLocation={searchCenter}
          refuelLiters={refuelLiters}
          vehicleConsumption={vehicleConsumption}
          loading={routeLoading}
          canPlan={Boolean(effectiveOrigin && effectiveDestination && selectedFuel)}
          onSetOriginFromLocation={handleSetOriginFromLocation}
          onStartPickOrigin={() => setMapPickMode('origin')}
          onStartPickDestination={() => setMapPickMode('destination')}
          onCancelPick={() => setMapPickMode(null)}
          onOriginSelect={handleOriginSelect}
          onDestinationSelect={handleDestinationSelect}
          onRefuelLitersChange={setRefuelLitersOverride}
          onVehicleConsumptionChange={setVehicleConsumptionOverride}
          onPlanRoute={handlePlanRoute}
          onClearRoute={handleClearRoute}
        />
      </section>

      <div className={styles.viewToggle} role="tablist" aria-label="View mode">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'map'}
          className={viewMode === 'map' ? styles.tabActive : styles.tab}
          onClick={() => setViewMode('map')}
        >
          {dict.nav.map}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'list'}
          className={viewMode === 'list' ? styles.tabActive : styles.tab}
          onClick={() => setViewMode('list')}
        >
          {dict.nav.list}
        </button>
      </div>

      <div className={styles.main}>
        <div
          className={`${styles.mapPane} ${viewMode === 'list' ? styles.hiddenMobile : ''}`}
        >
          {mapError && (
            <StatusMessage variant="error">
              {dict.errors.mapLoadFailed}
            </StatusMessage>
          )}
          <StationMap
            stations={mapStations}
            userLocation={usingFallback ? null : userLocation}
            selectedStationId={selectedStationId ?? selectedRouteCandidateId}
            initialCenter={searchCenter}
            onStationSelect={setSelectedStationId}
            onViewportChange={handleViewportChange}
            onMapError={() => setMapError(true)}
            fitStationId={fitStationId}
            routeGeometry={routeResults?.route.geometry ?? null}
            routeOrigin={effectiveOrigin}
            routeDestination={effectiveDestination}
            mapPickMode={mapPickMode}
            onMapPick={handleMapPick}
            fitRouteKey={fitRouteKey}
            fitLocationKey={fitLocationKey}
            fitLocationBounds={fitLocationBounds}
          />
        </div>

        <aside
          className={`${styles.listPane} ${viewMode === 'map' ? styles.hiddenMobile : ''}`}
        >
          {listHasRouteResults ? (
            <RouteResultsPanel
              result={routeResults}
              loading={routeLoading}
              error={routeError}
              selectedCandidateId={selectedRouteCandidateId}
              onSelectCandidate={handleSelectRouteCandidate}
            />
          ) : (
            <StationList
              stations={nearbyStations}
              loading={loadingNearby}
              error={nearbyError}
              notice={coverageNotice}
              selectedStationId={selectedStationId}
              fuelTypeId={selectedFuel?.id}
              onSelect={setSelectedStationId}
              onCenter={handleCenterStation}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
