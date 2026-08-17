export const AUTH_COOKIE_NAME = 'fuelmap_session';
export const AUTH_SESSION_TTL_SECONDS = 2_592_000; // 30 days
export const AUTH_SESSION_TOKEN_BYTES = 32;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

export const AUTH_THROTTLE = {
  name: 'auth',
  ttl: 60_000,
  limit: 10,
} as const;

export const REGISTER_THROTTLE = {
  name: 'register',
  ttl: 60_000,
  limit: 5,
} as const;

export type AuthenticatedUser = {
  id: string;
  email: string;
  emailNormalized: string;
  displayName: string | null;
  preferredLocale: string;
  isActive: boolean;
};

export type SafeUserProfile = {
  id: string;
  email: string;
  displayName: string | null;
  locale: string;
};

export type UserPreferencesResponse = {
  preferredFuelTypeId: string | null;
  preferredCurrency: string | null;
  defaultRefuelLiters: string | null;
  vehicleConsumptionLPer100Km: string | null;
  locale: string;
};
