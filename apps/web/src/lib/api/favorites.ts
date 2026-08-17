import { apiFetch } from '@/lib/api/client';
import type { FavoritesResponse } from '@/lib/api/types';

export async function fetchFavorites(
  signal?: AbortSignal,
): Promise<FavoritesResponse> {
  return apiFetch<FavoritesResponse>('/me/favorites', { signal });
}

export async function addFavorite(stationId: string): Promise<void> {
  await apiFetch<void>(`/me/favorites/${stationId}`, { method: 'POST' });
}

export async function removeFavorite(stationId: string): Promise<void> {
  await apiFetch<void>(`/me/favorites/${stationId}`, { method: 'DELETE' });
}
