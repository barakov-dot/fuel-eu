/** Deterministic UUID for the global crowdsourced data source. */
export const CROWDSOURCED_SOURCE_ID = 'c0000000-0000-4000-8000-000000000099';

export const CROWDSOURCED_SOURCE_CODE = 'FUELMAP_CROWDSOURCED';

export const CROWDSOURCED_SOURCE = {
  id: CROWDSOURCED_SOURCE_ID,
  code: CROWDSOURCED_SOURCE_CODE,
  name: 'FuelMap community',
  type: 'crowdsourced' as const,
  countryId: null,
  isActive: true,
  trustWeight: 30,
};
