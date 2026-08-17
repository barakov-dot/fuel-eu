export const DEFAULT_NEARBY_RADIUS_KM = 10;
export const DEFAULT_NEARBY_LIMIT = 50;
export const MAX_NEARBY_RADIUS_KM = 100;
export const MAX_NEARBY_LIMIT = 100;

export const DEFAULT_BBOX_LIMIT = 500;
export const MAX_BBOX_LIMIT = 1000;

export const NEARBY_SORT_DISTANCE = 'distance';
export const NEARBY_SORT_PRICE = 'price';

export const NEARBY_SORT_VALUES = [
  NEARBY_SORT_DISTANCE,
  NEARBY_SORT_PRICE,
] as const;

export type NearbySort = (typeof NEARBY_SORT_VALUES)[number];
