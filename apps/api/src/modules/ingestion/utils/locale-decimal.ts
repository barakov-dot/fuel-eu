/**
 * Parse locale-formatted decimal strings (e.g. Spanish "1,679" → 1.679).
 * Does not mutate arbitrary strings — only numeric decimal patterns.
 */
export function parseLocaleDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // Spanish upstream uses comma as decimal separator; dot as thousands is uncommon in fuel prices.
  const normalized = trimmed.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const num = Number(normalized);
  if (!Number.isFinite(num)) {
    return null;
  }
  return num;
}

export function formatPriceDecimal(value: number, decimals = 4): string {
  return value.toFixed(decimals);
}
