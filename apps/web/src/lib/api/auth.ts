import { apiFetch } from '@/lib/api/client';
import type { AuthMeResponse, UserPreferences } from '@/lib/api/types';

export async function fetchAuthMe(signal?: AbortSignal): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>('/auth/me', { signal });
}

export async function registerAccount(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function logoutAccount(): Promise<void> {
  await apiFetch<void>('/auth/logout', { method: 'POST' });
}

export async function patchPreferences(
  input: Partial<UserPreferences>,
): Promise<UserPreferences> {
  return apiFetch<UserPreferences>('/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchPreferences(
  signal?: AbortSignal,
): Promise<UserPreferences> {
  return apiFetch<UserPreferences>('/me/preferences', { signal });
}

export async function deleteAccount(password?: string): Promise<void> {
  await apiFetch<void>('/me', {
    method: 'DELETE',
    body: JSON.stringify(password ? { password } : {}),
  });
}
