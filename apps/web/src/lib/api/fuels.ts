import { apiFetch } from '@/lib/api/client';
import type { FuelType } from '@/lib/api/types';

export function fetchFuelTypes(signal?: AbortSignal): Promise<FuelType[]> {
  return apiFetch<FuelType[]>('/fuel-types', { signal });
}
