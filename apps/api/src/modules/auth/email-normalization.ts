/**
 * Deterministic email normalization for lookup and uniqueness.
 *
 * Rules:
 * 1. Trim leading/trailing whitespace from the full address.
 * 2. Lowercase the entire address (local part + domain).
 * 3. Do NOT apply Gmail dot/plus or other provider-specific transforms.
 *
 * The original email (trimmed) is stored in `users.email` for display.
 * `users.email_normalized` is used for uniqueness and login lookup.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailFormat(email: string): boolean {
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
