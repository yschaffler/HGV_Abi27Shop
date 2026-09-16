import { ORDER_LIMITS } from './validation/order';

/**
 * Warenkorb im Browser.
 *
 * Gespeichert werden ausschließlich Varianten-ID und Menge – niemals Preise, Namen oder
 * sonstige Daten. Alles, was am Ende Geld kostet, rechnet der Server aus der Datenbank.
 * Ein manipulierter localStorage kann darum nur den eigenen Warenkorb kaputt machen.
 */

export type CartItem = {
  variantId: string;
  quantity: number;
};

export const CART_STORAGE_KEY = 'abishop.cart.v1';

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['variantId'] === 'string' &&
    candidate['variantId'].length > 0 &&
    candidate['variantId'].length <= 64 &&
    typeof candidate['quantity'] === 'number' &&
    Number.isInteger(candidate['quantity']) &&
    candidate['quantity'] >= 1
  );
}

/** Liest den Warenkorb defensiv: kaputter oder manipulierter Inhalt ergibt einen leeren Korb. */
export function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return normalizeCart(parsed.filter(isCartItem));
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Privater Modus oder voller Speicher: der Warenkorb ist dann eben nicht persistent.
  }
}

/** Fasst doppelte Varianten zusammen und klemmt die Mengen auf die erlaubten Grenzen. */
export function normalizeCart(items: CartItem[]): CartItem[] {
  const merged = new Map<string, number>();

  for (const item of items) {
    const next = (merged.get(item.variantId) ?? 0) + item.quantity;
    merged.set(item.variantId, Math.min(next, ORDER_LIMITS.maxQuantityPerLine));
  }

  return [...merged.entries()]
    .filter(([, quantity]) => quantity > 0)
    .slice(0, ORDER_LIMITS.maxLines)
    .map(([variantId, quantity]) => ({ variantId, quantity }));
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
