/**
 * Geld wird durchgehend als ganzzahlige Cent-Beträge gerechnet.
 * Keine Gleitkommazahlen – 0.1 + 0.2 !== 0.3 hat in einem Shop nichts verloren.
 */

const FORMATTER = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export function formatCents(cents: number): string {
  if (!Number.isFinite(cents)) throw new TypeError('Betrag ist keine endliche Zahl');
  return FORMATTER.format(cents / 100);
}

/** "39,90" oder "39.90" -> 3990. Wirft bei allem, was kein sauberer Betrag ist. */
export function parseEuroInput(input: string): number {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Ungültiger Betrag');
  }
  return Math.round(Number.parseFloat(normalized) * 100);
}

export function centsToEuroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
