/** Deterministic UUIDs for development fixtures. */
export const DEV_IDS = {
  finlandCountry: 'b0000001-0000-4000-8000-000000000001',
  eurCurrency: 'b0000002-0000-4000-8000-000000000001',
  sekCurrency: 'b0000002-0000-4000-8000-000000000002',
  sourceOfficialFi: 'c0000001-0000-4000-8000-000000000001',
  sourceCommercialFi: 'c0000002-0000-4000-8000-000000000002',
  stationHelsinkiNeste: 'a0000001-0000-4000-8000-000000000001',
  stationHelsinkiShell: 'a0000001-0000-4000-8000-000000000002',
  stationEspooTeboil: 'a0000001-0000-4000-8000-000000000003',
  stationHelsinkiNoPrice: 'a0000001-0000-4000-8000-000000000004',
  stationPorvooOutOfRange: 'a0000001-0000-4000-8000-000000000005',
  stationHelsinkiBudget: 'a0000001-0000-4000-8000-000000000006',
  stationHelsinkiSekPrice: 'a0000001-0000-4000-8000-000000000007',
  fuelE10: 'd0000001-0000-4000-8000-000000000001',
  fuelDiesel: 'd0000001-0000-4000-8000-000000000002',
  fuelSp95: 'd0000001-0000-4000-8000-000000000003',
  mappingNesteOfficial: 'e0000001-0000-4000-8000-000000000001',
  mappingShellCommercial: 'e0000001-0000-4000-8000-000000000002',
  mappingTeboilOfficial: 'e0000001-0000-4000-8000-000000000003',
  mappingBudgetOfficial: 'e0000001-0000-4000-8000-000000000004',
  mappingSekOfficial: 'e0000001-0000-4000-8000-000000000005',
  obsNesteE10TieA: 'f0000001-0000-4000-8000-000000000001',
  obsNesteE10TieB: 'f0000001-0000-4000-8000-000000000002',
} as const;

export const PRIMARY_DEV_STATION_ID = DEV_IDS.stationHelsinkiNeste;

/** Helsinki center reference point used in geospatial tests. */
export const HELSINKI_CENTER = {
  lat: 60.1699,
  lon: 24.9384,
} as const;
