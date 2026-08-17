export function parseQueryBoolean(value: unknown): boolean {
  if (value === 'true' || value === true) {
    return true;
  }
  if (value === 'false' || value === false) {
    return false;
  }
  return value as boolean;
}

export function parseQueryCurrency(value: unknown): string {
  return typeof value === 'string' ? value.toUpperCase() : String(value);
}
