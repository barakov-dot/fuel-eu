'use client';

import { Button } from '@/components/ui/Button';
import { useDictionary } from '@/components/i18n/I18nProvider';
import { PlaceSearch } from '@/components/search/PlaceSearch';
import type { GeocodingResult, RoutePoint } from '@/lib/api/types';
import type { GeoPosition } from '@/lib/geo/location';
import { formatRoutePointLabel } from '@/lib/geo/route';
import styles from './RoutePlannerPanel.module.css';

export type MapPickMode = 'origin' | 'destination' | null;

type RoutePlannerPanelProps = {
  origin: RoutePoint | null;
  destination: RoutePoint | null;
  mapPickMode: MapPickMode;
  searchBiasLocation: { lat: number; lon: number } | null;
  refuelLiters: string;
  vehicleConsumption: string;
  loading: boolean;
  canPlan: boolean;
  onSetOriginFromLocation: () => void;
  onStartPickOrigin: () => void;
  onStartPickDestination: () => void;
  onCancelPick: () => void;
  onOriginSelect: (result: GeocodingResult) => void;
  onDestinationSelect: (result: GeocodingResult) => void;
  onRefuelLitersChange: (value: string) => void;
  onVehicleConsumptionChange: (value: string) => void;
  onPlanRoute: () => void;
  onClearRoute: () => void;
};

export function RoutePlannerPanel({
  origin,
  destination,
  mapPickMode,
  searchBiasLocation,
  refuelLiters,
  vehicleConsumption,
  loading,
  canPlan,
  onSetOriginFromLocation,
  onStartPickOrigin,
  onStartPickDestination,
  onCancelPick,
  onOriginSelect,
  onDestinationSelect,
  onRefuelLitersChange,
  onVehicleConsumptionChange,
  onPlanRoute,
  onClearRoute,
}: RoutePlannerPanelProps) {
  const dict = useDictionary();

  return (
    <section className={styles.panel} aria-label={dict.route.title}>
      <div className={styles.header}>
        <h2 className={styles.title}>{dict.route.title}</h2>
        {origin && destination && (
          <button type="button" className={styles.clearLink} onClick={onClearRoute}>
            {dict.route.clear}
          </button>
        )}
      </div>

      <div className={styles.pointRow}>
        <span className={styles.pointLabel}>{dict.route.origin}</span>
        <PlaceSearch
          key={origin ? `${origin.lat},${origin.lon},${origin.label ?? ''}` : 'origin-empty'}
          placeholder={dict.geocode.originPlaceholder}
          selectedLabel={origin?.label ?? null}
          biasLocation={searchBiasLocation}
          onSelect={onOriginSelect}
        />
        <div className={styles.pointActions}>
          <Button variant="secondary" onClick={onSetOriginFromLocation}>
            {dict.route.useMyLocation}
          </Button>
          <Button
            variant={mapPickMode === 'origin' ? 'primary' : 'secondary'}
            onClick={onStartPickOrigin}
          >
            {dict.route.pickOnMap}
          </Button>
        </div>
        <p className={styles.pointValue}>
          {origin ? formatRoutePointLabel(origin) : dict.route.notSet}
        </p>
      </div>

      <div className={styles.pointRow}>
        <span className={styles.pointLabel}>{dict.route.destination}</span>
        <PlaceSearch
          key={
            destination
              ? `${destination.lat},${destination.lon},${destination.label ?? ''}`
              : 'destination-empty'
          }
          placeholder={dict.geocode.destinationPlaceholder}
          selectedLabel={destination?.label ?? null}
          biasLocation={searchBiasLocation}
          onSelect={onDestinationSelect}
        />
        <div className={styles.pointActions}>
          <Button
            variant={mapPickMode === 'destination' ? 'primary' : 'secondary'}
            onClick={onStartPickDestination}
          >
            {dict.route.pickOnMap}
          </Button>
        </div>
        <p className={styles.pointValue}>
          {destination ? formatRoutePointLabel(destination) : dict.route.notSet}
        </p>
      </div>

      {mapPickMode && (
        <p className={styles.pickHint}>
          {mapPickMode === 'origin'
            ? dict.route.pickOriginHint
            : dict.route.pickDestinationHint}
          {' '}
          <button type="button" className={styles.inlineAction} onClick={onCancelPick}>
            {dict.route.cancelPick}
          </button>
        </p>
      )}

      <div className={styles.inputs}>
        <label className={styles.field}>
          <span>{dict.route.refuelLiters}</span>
          <input
            type="number"
            min="1"
            max="200"
            step="1"
            value={refuelLiters}
            onChange={(event) => onRefuelLitersChange(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>{dict.route.consumption}</span>
          <input
            type="number"
            min="1"
            max="50"
            step="0.1"
            value={vehicleConsumption}
            onChange={(event) => onVehicleConsumptionChange(event.target.value)}
          />
        </label>
      </div>

      <Button onClick={onPlanRoute} disabled={!canPlan || loading}>
        {loading ? dict.route.planning : dict.route.planRoute}
      </Button>
    </section>
  );
}

export function routePointFromGeo(position: GeoPosition, label?: string): RoutePoint {
  return { lat: position.lat, lon: position.lon, label };
}

export function routePointFromGeocoding(result: GeocodingResult): RoutePoint {
  return {
    lat: result.location.lat,
    lon: result.location.lon,
    label: result.displayName,
  };
}
