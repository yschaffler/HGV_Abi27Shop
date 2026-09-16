import type { PaymentStatus } from '@/generated/prisma/enums';

/**
 * Aggregation für die Sammelbestellung.
 *
 * Das ist die Funktion, wegen der es diesen Shop überhaupt gibt: Aus 160 Einzelbestellungen
 * wird eine Liste, die man beim Hersteller aufgeben kann.
 *
 * Bewusst als reine Funktion über bereits geladene Positionen – so ist sie ohne Datenbank
 * testbar, und die Sortierlogik (Größen in S/M/L-Reihenfolge, nicht alphabetisch) steht
 * an genau einer Stelle.
 */

export type AggregatableItem = {
  variantId: string;
  productName: string;
  variantLabel: string;
  color: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type AggregateRow = {
  variantId: string;
  productName: string;
  variantLabel: string;
  color: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  /** Anzahl der Bestellungen, in denen diese Variante vorkommt. */
  orderCount: number;
};

/**
 * Konfektionsgrößen gehören in ihre natürliche Reihenfolge, nicht ins Alphabet.
 * Alles Unbekannte landet dahinter und wird alphabetisch sortiert.
 */
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];

function sizeRank(size: string): number {
  const index = SIZE_ORDER.indexOf(size.trim().toUpperCase());
  return index === -1 ? SIZE_ORDER.length : index;
}

export function compareAggregateRows(a: AggregateRow, b: AggregateRow): number {
  const byProduct = a.productName.localeCompare(b.productName, 'de');
  if (byProduct !== 0) return byProduct;

  const byColor = a.color.localeCompare(b.color, 'de');
  if (byColor !== 0) return byColor;

  const bySize = sizeRank(a.size) - sizeRank(b.size);
  if (bySize !== 0) return bySize;

  return a.size.localeCompare(b.size, 'de');
}

export function aggregateItems(
  items: ReadonlyArray<AggregatableItem & { orderId: string }>,
): AggregateRow[] {
  const byVariant = new Map<string, AggregateRow & { orderIds: Set<string> }>();

  for (const item of items) {
    const existing = byVariant.get(item.variantId);

    if (existing) {
      existing.quantity += item.quantity;
      existing.totalCents += item.lineTotalCents;
      existing.orderIds.add(item.orderId);
      continue;
    }

    byVariant.set(item.variantId, {
      variantId: item.variantId,
      productName: item.productName,
      variantLabel: item.variantLabel,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalCents: item.lineTotalCents,
      orderCount: 0,
      orderIds: new Set([item.orderId]),
    });
  }

  return [...byVariant.values()]
    .map(({ orderIds, ...row }) => ({ ...row, orderCount: orderIds.size }))
    .sort(compareAggregateRows);
}

/**
 * Für die Sammelbestellung zählt ausschließlich, was auch bezahlt ist. Eine unbezahlte
 * Bestellung darf nicht beim Hersteller landen.
 */
export const AGGREGATE_PAYMENT_STATUSES: PaymentStatus[] = ['PAID'];
