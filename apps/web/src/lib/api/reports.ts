import { apiFetch } from './client';

export type PriceReport = {
  id: string;
  stationId: string;
  fuelTypeId: string;
  fuelCode: string;
  fuelName: string;
  price: string;
  currency: string;
  reportedAt: string;
  createdAt: string;
  status: string;
  confidence: string;
  confirmations: number;
  disputes: number;
  isAuthor: boolean;
  userVote: 'confirm' | 'dispute' | null;
  evidence?: {
    hasPhoto: boolean;
    ocrAssisted: boolean;
  };
};

export type MyPriceReport = PriceReport & {
  station: {
    id: string;
    name: string | null;
    brand: string | null;
    city: string | null;
    countryIso2: string;
  };
};

export type ReputationSummary = {
  score: number;
  acceptedReportsCount: number;
  confirmedReportsCount: number;
  rejectedReportsCount: number;
};

export type CreateReportPayload = {
  fuelTypeId: string;
  price: string;
  currency: string;
  reportedAt?: string;
  location?: { lat: number; lon: number };
  comment?: string;
  reportImageId?: string;
  ocrAssisted?: boolean;
  originalCandidate?: {
    fuelCodeSuggestion?: string;
    rawLabel?: string;
    price?: string;
    confidence?: number;
  };
};

export async function createPriceReport(
  stationId: string,
  payload: CreateReportPayload,
  signal?: AbortSignal,
): Promise<PriceReport> {
  return apiFetch<PriceReport>(`/stations/${stationId}/reports`, {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
  });
}

export async function fetchStationReports(
  stationId: string,
  params?: { fuelTypeId?: string; limit?: number },
  signal?: AbortSignal,
): Promise<{ items: PriceReport[] }> {
  const search = new URLSearchParams();
  if (params?.fuelTypeId) {
    search.set('fuelTypeId', params.fuelTypeId);
  }
  if (params?.limit) {
    search.set('limit', String(params.limit));
  }
  const query = search.toString();
  return apiFetch<{ items: PriceReport[] }>(
    `/stations/${stationId}/reports${query ? `?${query}` : ''}`,
    { signal },
  );
}

export async function voteOnReport(
  reportId: string,
  vote: 'confirm' | 'dispute',
  signal?: AbortSignal,
) {
  return apiFetch(`/reports/${reportId}/vote`, {
    method: 'PUT',
    body: JSON.stringify({ vote }),
    signal,
  });
}

export async function fetchMyReports(
  limit = 20,
  signal?: AbortSignal,
): Promise<{ items: MyPriceReport[] }> {
  return apiFetch<{ items: MyPriceReport[] }>(
    `/me/reports?limit=${limit}`,
    { signal },
  );
}

export async function fetchMyReputation(
  signal?: AbortSignal,
): Promise<ReputationSummary> {
  return apiFetch<ReputationSummary>('/me/reputation', { signal });
}
