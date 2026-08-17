'use client';

import {
  useEffect,
  useRef,
  useCallback,
  type MutableRefObject,
} from 'react';
import {
  Map,
  NavigationControl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getWebEnvSafe } from '@/lib/env';
import type { MapStation } from '@/lib/stations/helpers';
import type { GeoPosition } from '@/lib/geo/location';
import type { RouteGeometry } from '@/lib/api/types';
import styles from './StationMap.module.css';

type MapPickMode = 'origin' | 'destination' | null;

const STATIONS_SOURCE = 'stations';
const STATIONS_CIRCLE_LAYER = 'stations-circle';
const STATIONS_LABEL_LAYER = 'stations-label';
const USER_SOURCE = 'user-location';
const USER_LAYER = 'user-location-circle';
const ROUTE_SOURCE = 'route-line';
const ROUTE_LAYER = 'route-line-layer';
const ENDPOINTS_SOURCE = 'route-endpoints';
const ENDPOINTS_LAYER = 'route-endpoints-circle';
const ENDPOINTS_LABEL_LAYER = 'route-endpoints-label';

type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type FitLocationBounds = ViewportBounds;

type StationMapProps = {
  stations: MapStation[];
  userLocation?: GeoPosition | null;
  selectedStationId?: string;
  initialCenter: GeoPosition;
  initialZoom?: number;
  onStationSelect?: (stationId: string) => void;
  onViewportChange?: (bounds: ViewportBounds) => void;
  onMapError?: () => void;
  fitStationId?: string | null;
  routeGeometry?: RouteGeometry | null;
  routeOrigin?: GeoPosition | null;
  routeDestination?: GeoPosition | null;
  mapPickMode?: MapPickMode;
  onMapPick?: (point: GeoPosition) => void;
  fitRouteKey?: string | null;
  fitLocationKey?: string | null;
  fitLocationBounds?: FitLocationBounds | null;
};

function stationsToGeoJson(stations: MapStation[]) {
  return {
    type: 'FeatureCollection' as const,
    features: stations.map((station) => ({
      type: 'Feature' as const,
      id: station.id,
      geometry: {
        type: 'Point' as const,
        coordinates: [station.lon, station.lat] as [number, number],
      },
      properties: {
        id: station.id,
        priceLabel: station.priceLabel ?? '',
      },
    })),
  };
}

function ensureStationLayers(map: Map) {
  if (!map.getSource(STATIONS_SOURCE)) {
    map.addSource(STATIONS_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getLayer(STATIONS_CIRCLE_LAYER)) {
    map.addLayer({
      id: STATIONS_CIRCLE_LAYER,
      type: 'circle',
      source: STATIONS_SOURCE,
      paint: {
        'circle-radius': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          12,
          9,
        ],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          '#0b6bcb',
          '#1f7a4d',
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });
  }

  if (!map.getLayer(STATIONS_LABEL_LAYER)) {
    map.addLayer({
      id: STATIONS_LABEL_LAYER,
      type: 'symbol',
      source: STATIONS_SOURCE,
      layout: {
        'text-field': ['get', 'priceLabel'],
        'text-size': 11,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-offset': [0, -1.6],
        'text-anchor': 'bottom',
      },
      paint: {
        'text-color': '#0f172a',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
      filter: ['!=', ['get', 'priceLabel'], ''],
    });
  }

  if (!map.getSource(USER_SOURCE)) {
    map.addSource(USER_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getLayer(USER_LAYER)) {
    map.addLayer({
      id: USER_LAYER,
      type: 'circle',
      source: USER_SOURCE,
      paint: {
        'circle-radius': 8,
        'circle-color': '#2563eb',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    });
  }

  if (!map.getSource(ROUTE_SOURCE)) {
    map.addSource(ROUTE_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getLayer(ROUTE_LAYER)) {
    map.addLayer(
      {
        id: ROUTE_LAYER,
        type: 'line',
        source: ROUTE_SOURCE,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#2563eb',
          'line-width': 4,
          'line-opacity': 0.85,
        },
      },
      STATIONS_CIRCLE_LAYER,
    );
  }

  if (!map.getSource(ENDPOINTS_SOURCE)) {
    map.addSource(ENDPOINTS_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getLayer(ENDPOINTS_LAYER)) {
    map.addLayer({
      id: ENDPOINTS_LAYER,
      type: 'circle',
      source: ENDPOINTS_SOURCE,
      paint: {
        'circle-radius': 10,
        'circle-color': [
          'match',
          ['get', 'role'],
          'origin',
          '#16a34a',
          'destination',
          '#dc2626',
          '#64748b',
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    });
  }

  if (!map.getLayer(ENDPOINTS_LABEL_LAYER)) {
    map.addLayer({
      id: ENDPOINTS_LABEL_LAYER,
      type: 'symbol',
      source: ENDPOINTS_SOURCE,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 11,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-offset': [0, -1.8],
        'text-anchor': 'bottom',
      },
      paint: {
        'text-color': '#0f172a',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    });
  }
}

function updateSelectedFeature(
  map: Map,
  previousId: string | undefined,
  nextId: string | undefined,
) {
  if (previousId) {
    map.setFeatureState(
      { source: STATIONS_SOURCE, id: previousId },
      { selected: false },
    );
  }
  if (nextId) {
    map.setFeatureState(
      { source: STATIONS_SOURCE, id: nextId },
      { selected: true },
    );
  }
}

export function StationMap({
  stations,
  userLocation,
  selectedStationId,
  initialCenter,
  initialZoom = 12,
  onStationSelect,
  onViewportChange,
  onMapError,
  fitStationId,
  routeGeometry,
  routeOrigin,
  routeDestination,
  mapPickMode,
  onMapPick,
  fitRouteKey,
  fitLocationKey,
  fitLocationBounds,
}: StationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const selectedRef = useRef<string | undefined>(undefined);
  const onViewportChangeRef = useRef(onViewportChange);
  const onStationSelectRef = useRef(onStationSelect);
  const onMapErrorRef = useRef(onMapError);
  const onMapPickRef = useRef(onMapPick);
  const mapPickModeRef = useRef(mapPickMode);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
    onStationSelectRef.current = onStationSelect;
    onMapErrorRef.current = onMapError;
    onMapPickRef.current = onMapPick;
    mapPickModeRef.current = mapPickMode;
  }, [onMapError, onMapPick, onStationSelect, onViewportChange, mapPickMode]);

  const emitViewport = useCallback((map: Map) => {
    const bounds = map.getBounds();
    onViewportChangeRef.current?.({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const styleUrl = getWebEnvSafe().NEXT_PUBLIC_MAP_STYLE_URL;

    const map = new Map({
      container: containerRef.current,
      style: styleUrl,
      center: [initialCenter.lon, initialCenter.lat],
      zoom: initialZoom,
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    map.on('error', () => {
      onMapErrorRef.current?.();
    });

    map.on('load', () => {
      ensureStationLayers(map);
      emitViewport(map);
    });

    map.on('click', STATIONS_CIRCLE_LAYER, (event: MapLayerMouseEvent) => {
      if (mapPickModeRef.current) {
        return;
      }
      const feature = event.features?.[0];
      const stationId = feature?.properties?.id as string | undefined;
      if (stationId) {
        onStationSelectRef.current?.(stationId);
      }
    });

    map.on('click', (event) => {
      if (!mapPickModeRef.current) {
        return;
      }
      onMapPickRef.current?.({
        lat: event.lngLat.lat,
        lon: event.lngLat.lng,
      });
    });

    map.on('mouseenter', STATIONS_CIRCLE_LAYER, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', STATIONS_CIRCLE_LAYER, () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('moveend', () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        emitViewport(map);
      }, 400);
    });

    mapRef.current = map;

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      map.remove();
      mapRef.current = null;
    };
  }, [emitViewport, initialCenter.lat, initialCenter.lon, initialZoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const source = map.getSource(STATIONS_SOURCE) as GeoJSONSource | undefined;
    if (source) {
      source.setData(stationsToGeoJson(stations));
    }
  }, [stations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const source = map.getSource(USER_SOURCE) as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    if (!userLocation) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [userLocation.lon, userLocation.lat],
          },
          properties: {},
        },
      ],
    });
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    updateSelectedFeature(map, selectedRef.current, selectedStationId);
    selectedRef.current = selectedStationId;
  }, [selectedStationId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitStationId) {
      return;
    }

    const station = stations.find((item) => item.id === fitStationId);
    if (station) {
      map.flyTo({
        center: [station.lon, station.lat],
        zoom: Math.max(map.getZoom(), 14),
        essential: true,
      });
    }
  }, [fitStationId, stations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const routeSource = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined;
    if (routeSource) {
      if (routeGeometry) {
        routeSource.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: routeGeometry,
              properties: {},
            },
          ],
        });
      } else {
        routeSource.setData({ type: 'FeatureCollection', features: [] });
      }
    }

    const endpointSource = map.getSource(ENDPOINTS_SOURCE) as
      | GeoJSONSource
      | undefined;
    if (endpointSource) {
      const features = [];
      if (routeOrigin) {
        features.push({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [routeOrigin.lon, routeOrigin.lat] as [number, number],
          },
          properties: { role: 'origin', label: 'A' },
        });
      }
      if (routeDestination) {
        features.push({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [routeDestination.lon, routeDestination.lat] as [
              number,
              number,
            ],
          },
          properties: { role: 'destination', label: 'B' },
        });
      }
      endpointSource.setData({ type: 'FeatureCollection', features });
    }
  }, [routeDestination, routeGeometry, routeOrigin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitRouteKey || !routeGeometry) {
      return;
    }

    const coordinates = routeGeometry.coordinates;
    if (coordinates.length === 0) {
      return;
    }

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

    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 48, duration: 800 },
    );
  }, [fitRouteKey, routeGeometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitLocationKey) {
      return;
    }

    if (fitLocationBounds) {
      map.fitBounds(
        [
          [fitLocationBounds.west, fitLocationBounds.south],
          [fitLocationBounds.east, fitLocationBounds.north],
        ],
        { padding: 48, duration: 800 },
      );
      return;
    }

    map.flyTo({
      center: [initialCenter.lon, initialCenter.lat],
      zoom: Math.max(map.getZoom(), 12),
      essential: true,
    });
  }, [fitLocationBounds, fitLocationKey, initialCenter.lat, initialCenter.lon]);

  return (
    <div
      ref={containerRef}
      className={`${styles.map} ${mapPickMode ? styles.pickMode : ''}`}
      data-testid="station-map"
    />
  );
}

export function centerMapOnStation(
  mapRef: MutableRefObject<Map | null>,
  station: MapStation,
) {
  mapRef.current?.flyTo({
    center: [station.lon, station.lat],
    zoom: Math.max(mapRef.current.getZoom(), 14),
    essential: true,
  });
}
