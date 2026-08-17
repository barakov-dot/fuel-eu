export function formatPrice(price: string, currency: string, locale: string): string {
  const numeric = Number(price);
  if (Number.isNaN(numeric)) {
    return `${price} ${currency}`;
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(numeric);
}

export function formatPriceCompact(
  price: string,
  currency: string,
  locale: string,
): string {
  const numeric = Number(price);
  if (Number.isNaN(numeric)) {
    return price;
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}
