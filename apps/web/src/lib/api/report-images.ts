import { getWebEnvSafe } from '@/lib/env';
import { ApiError } from '@/lib/api/types';

function getBaseUrl(): string {
  return getWebEnvSafe().NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '');
}

export type ReportImageCandidate = {
  fuelCodeSuggestion: string;
  fuelTypeId: string | null;
  rawLabel: string;
  price: string;
  confidence: number;
};

export type ReportImageStatus = {
  id: string;
  status: string;
  stationId: string;
  width: number;
  height: number;
  mimeType: string;
  createdAt: string;
  candidates: ReportImageCandidate[];
  failureReason?: string;
};

export async function uploadReportImage(
  stationId: string,
  file: File,
  signal?: AbortSignal,
): Promise<ReportImageStatus> {
  const url = `${getBaseUrl()}/stations/${stationId}/report-images`;
  const formData = new FormData();
  formData.append('image', file);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      signal,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Network request failed';
    throw new ApiError(message, 0);
  }

  if (!response.ok) {
    let message = `Upload failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (typeof body.message === 'string') {
        message = body.message;
      } else if (Array.isArray(body.message)) {
        message = body.message.join(', ');
      }
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<ReportImageStatus>;
}

export async function fetchReportImageStatus(
  imageId: string,
  signal?: AbortSignal,
): Promise<ReportImageStatus> {
  const url = `${getBaseUrl()}/report-images/${imageId}`;

  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Network request failed';
    throw new ApiError(message, 0);
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<ReportImageStatus>;
}

export async function pollReportImageUntilReady(
  imageId: string,
  options?: { maxAttempts?: number; intervalMs?: number; signal?: AbortSignal },
): Promise<ReportImageStatus> {
  const maxAttempts = options?.maxAttempts ?? 30;
  const intervalMs = options?.intervalMs ?? 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await fetchReportImageStatus(imageId, options?.signal);
    if (status.status === 'processed' || status.status === 'failed') {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return fetchReportImageStatus(imageId, options?.signal);
}

export async function deleteReportImage(
  imageId: string,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${getBaseUrl()}/report-images/${imageId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
    signal,
  });

  if (!response.ok && response.status !== 204) {
    throw new ApiError(`Delete failed with status ${response.status}`, response.status);
  }
}
