import {
  GERMANY_BOUNDS,
  GERMANY_GRID_STEP_LAT,
  GERMANY_GRID_STEP_LNG,
} from './germany.constants';

export type GridPoint = { lat: number; lng: number };

export function generateGermanyDiscoveryGrid(): GridPoint[] {
  const points: GridPoint[] = [];

  for (
    let lat = GERMANY_BOUNDS.minLat;
    lat <= GERMANY_BOUNDS.maxLat;
    lat += GERMANY_GRID_STEP_LAT
  ) {
    for (
      let lng = GERMANY_BOUNDS.minLng;
      lng <= GERMANY_BOUNDS.maxLng;
      lng += GERMANY_GRID_STEP_LNG
    ) {
      points.push({
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
      });
    }
  }

  return points;
}
