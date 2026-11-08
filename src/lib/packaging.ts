/** Decimal-safe helpers shared by the order workflow (client) and the API (server). Amounts are handled in integer cents. */

export const LIMITS = { cartons: 9999, sachets: 99999, perCarton: 10000, price: 1000000, totalSachets: 10000000 };

export function toCents(value: number | string) {
  return Math.round(Number(value) * 100);
}

/** Integer-only conversion back to a "123.45" string (no floating point division). */
export function centsToDecimal(cents: number) {
  const rounded = Math.round(cents);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function hasTwoDecimals(value: number) {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

export function totalSachetsOf(cartons: number, sachets: number, perCarton: number) {
  return cartons * perCarton + sachets;
}

export function lineTotalCents(totalSachets: number, priceCents: number) {
  return totalSachets * priceCents;
}

/** Positive result = discount, negative = markup, in percent of the catalogue price. */
export function priceDeltaPercent(defaultCents: number, priceCents: number) {
  if (defaultCents <= 0) return 0;
  return ((defaultCents - priceCents) / defaultCents) * 100;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** "2 cartons × 12 + 6 sachets" */
export function packingLabel(cartons: number, sachets: number, perCarton: number) {
  const parts: string[] = [];
  if (cartons > 0) parts.push(`${plural(cartons, "carton")} × ${perCarton}`);
  if (sachets > 0) parts.push(plural(sachets, "sachet"));
  return parts.length ? parts.join(" + ") : "Aucune quantité";
}
