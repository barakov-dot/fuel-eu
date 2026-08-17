export type OsrmRouteGeometry =
  { type: 'LineString'; coordinates: [number, number][] } | string;

export type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: OsrmRouteGeometry;
};

export type OsrmRouteResponse = {
  code: string;
  message?: string;
  routes?: OsrmRoute[];
};
