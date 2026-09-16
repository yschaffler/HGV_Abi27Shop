import { ORDER_LIMITS, type CartLineInput } from '@/lib/validation/order';
import { variantLabel } from '@/lib/variant-label';

/**
 * Preisberechnung – das sicherheitskritische Herzstück des Shops.
 *
 * Diese Funktion ist bewusst *rein*: sie bekommt die aus der Datenbank geladenen Varianten
 * und die vom Client gewünschten Mengen und rechnet daraus den Gesamtpreis. Sie kennt
 * keinen Preis, der vom Client kommt, weil es einen solchen Wert im Eingabetyp gar nicht gibt.
 * Dadurch ist Preismanipulation nicht "verhindert", sondern strukturell unmöglich.
 */

export type CatalogVariant = {
  id: string;
  productId: string;
  productName: string;
  productActive: boolean;
  color: string;
  size: string;
  label: string;
  priceCents: number;
  active: boolean;
};

export type PricedLine = {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  color: string;
  size: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type PricedCart = {
  lines: PricedLine[];
  totalQuantity: number;
  totalCents: number;
};

export type PricingErrorCode =
  | 'EMPTY_CART'
  | 'TOO_MANY_LINES'
  | 'UNKNOWN_VARIANT'
  | 'VARIANT_UNAVAILABLE'
  | 'QUANTITY_OUT_OF_RANGE'
  | 'TOTAL_QUANTITY_EXCEEDED'
  | 'INVALID_PRICE';

export type PricingResult =
  | { ok: true; cart: PricedCart }
  | { ok: false; code: PricingErrorCode; message: string; variantId?: string };

const MESSAGES: Record<PricingErrorCode, string> = {
  EMPTY_CART: 'Der Warenkorb ist leer.',
  TOO_MANY_LINES: 'Der Warenkorb enthält zu viele verschiedene Artikel.',
  UNKNOWN_VARIANT: 'Ein Artikel im Warenkorb existiert nicht mehr.',
  VARIANT_UNAVAILABLE: 'Ein Artikel im Warenkorb ist nicht mehr bestellbar.',
  QUANTITY_OUT_OF_RANGE: `Bitte zwischen 1 und ${ORDER_LIMITS.maxQuantityPerLine} Stück je Artikel wählen.`,
  TOTAL_QUANTITY_EXCEEDED: `Eine Bestellung darf höchstens ${ORDER_LIMITS.maxTotalQuantity} Artikel enthalten.`,
  INVALID_PRICE: 'Für einen Artikel ist kein gültiger Preis hinterlegt.',
};

function fail(code: PricingErrorCode, variantId?: string): PricingResult {
  return { ok: false, code, message: MESSAGES[code], ...(variantId ? { variantId } : {}) };
}

/**
 * Mehrfach vorkommende Varianten werden zusammengefasst, bevor die Mengen geprüft werden.
 * Sonst könnte man die Obergrenze umgehen, indem man dieselbe Variante zehnmal als eigene
 * Zeile schickt.
 */
function mergeLines(input: CartLineInput[]): Map<string, number> {
  const merged = new Map<string, number>();
  for (const line of input) {
    merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
  }
  return merged;
}

export function priceCart(input: CartLineInput[], catalog: CatalogVariant[]): PricingResult {
  if (input.length === 0) return fail('EMPTY_CART');

  const merged = mergeLines(input);
  if (merged.size === 0) return fail('EMPTY_CART');
  if (merged.size > ORDER_LIMITS.maxLines) return fail('TOO_MANY_LINES');

  const byId = new Map(catalog.map((variant) => [variant.id, variant]));

  const lines: PricedLine[] = [];
  let totalCents = 0;
  let totalQuantity = 0;

  for (const [variantId, quantity] of merged) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > ORDER_LIMITS.maxQuantityPerLine) {
      return fail('QUANTITY_OUT_OF_RANGE', variantId);
    }

    const variant = byId.get(variantId);
    if (!variant) return fail('UNKNOWN_VARIANT', variantId);
    if (!variant.active || !variant.productActive) return fail('VARIANT_UNAVAILABLE', variantId);

    // Der Preis kommt ausschließlich aus der Datenbank.
    if (!Number.isInteger(variant.priceCents) || variant.priceCents <= 0) {
      return fail('INVALID_PRICE', variantId);
    }

    const lineTotalCents = variant.priceCents * quantity;

    lines.push({
      variantId: variant.id,
      productId: variant.productId,
      productName: variant.productName,
      variantLabel: variantLabel(variant),
      color: variant.color,
      size: variant.size,
      unitPriceCents: variant.priceCents,
      quantity,
      lineTotalCents,
    });

    totalCents += lineTotalCents;
    totalQuantity += quantity;
  }

  if (totalQuantity > ORDER_LIMITS.maxTotalQuantity) return fail('TOTAL_QUANTITY_EXCEEDED');

  // Stripe lehnt Beträge unter 0,50 EUR ab; ein solcher Warenkorb wäre ohnehin ein Fehler.
  if (totalCents < 50) return fail('INVALID_PRICE');

  return { ok: true, cart: { lines, totalQuantity, totalCents } };
}
