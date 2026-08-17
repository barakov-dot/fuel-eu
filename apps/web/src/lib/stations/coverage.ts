import type { Dictionary } from '@/lib/i18n/dictionaries';

export function serviceModeLabel(
  serviceMode: 'self' | 'served' | 'unknown' | undefined,
  dict: Dictionary,
): string | null {
  if (serviceMode === 'self') {
    return dict.stations.serviceSelf;
  }
  if (serviceMode === 'served') {
    return dict.stations.serviceServed;
  }
  return null;
}

export function coverageNoticeMessage(
  coverageType: string,
  limitations: string[] | undefined,
  dict: Dictionary,
): string | null {
  if (limitations?.includes('requires-data-sharing-agreement')) {
    return dict.stations.coverageUnavailable;
  }

  if (coverageType === 'blocked' || coverageType === 'crowdsourcing_only') {
    return dict.stations.coverageBlockedCommunity;
  }

  if (
    coverageType === 'on_demand_limited' ||
    coverageType === 'implemented_requires_credentials' ||
    coverageType === 'partial_network_coverage'
  ) {
    return coverageType === 'implemented_requires_credentials'
      ? dict.stations.coverageCredentials
      : dict.stations.coverageLimited;
  }

  return null;
}
