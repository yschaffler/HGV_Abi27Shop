import 'server-only';
import { prisma } from '../db';
import { loadAggregateRows } from '../export/exports';

/**
 * Kennzahlen für das Dashboard.
 *
 * Bewusst wenige, dafür die, nach denen im Betrieb tatsächlich gefragt wird:
 * Wie viele haben bestellt, wie viel Geld ist eingegangen, wie weit ist die Ausgabe,
 * und was muss beim Hersteller bestellt werden.
 */

/** Sortierbarer Schluessel: 2026-10-04 in deutscher Ortszeit. */
const DAY_KEY_FORMAT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' });

const DAY_LABEL_FORMAT = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

export type ShopStatistics = {
  orderCount: number;
  paidOrderCount: number;
  pendingOrderCount: number;
  revenuePaidCents: number;
  itemCountPaid: number;
  distributedItemCount: number;
  fullyDistributedOrderCount: number;
  /** Bezahlte Bestellungen je Kalendertag (deutsche Ortszeit) – zeigt die Bestellkurve. */
  ordersByDay: Array<{ day: string; label: string; orders: number; revenueCents: number }>;
  topVariants: Array<{ label: string; quantity: number }>;
};

export async function loadStatistics(): Promise<ShopStatistics> {
  const [counts, paidAggregate, paidOrders, distributedItems, fullyDistributed, aggregateRows] =
    await Promise.all([
      prisma.order.groupBy({ by: ['paymentStatus'], _count: { _all: true } }),
      prisma.order.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { totalCents: true } }),
      prisma.order.findMany({
        where: { paymentStatus: 'PAID' },
        select: { createdAt: true, totalCents: true },
      }),
      prisma.orderItem.count({
        where: { distributionStatus: 'DISTRIBUTED', order: { paymentStatus: 'PAID' } },
      }),
      prisma.order.count({ where: { paymentStatus: 'PAID', distributionStatus: 'FULLY_DISTRIBUTED' } }),
      loadAggregateRows(),
    ]);

  const countFor = (status: string): number =>
    counts.find((row) => row.paymentStatus === status)?._count._all ?? 0;

  // Gruppiert wird nach deutscher Ortszeit, nicht nach UTC: Eine Bestellung um 23:30 Uhr
  // gehoert fuer jeden, der auf die Liste schaut, zum laufenden Tag.
  const byDay = new Map<string, { orders: number; revenueCents: number }>();
  for (const order of paidOrders) {
    const day = DAY_KEY_FORMAT.format(order.createdAt);
    const entry = byDay.get(day) ?? { orders: 0, revenueCents: 0 };
    entry.orders += 1;
    entry.revenueCents += order.totalCents;
    byDay.set(day, entry);
  }

  return {
    orderCount: counts.reduce((sum, row) => sum + row._count._all, 0),
    paidOrderCount: countFor('PAID'),
    pendingOrderCount: countFor('PENDING'),
    revenuePaidCents: paidAggregate._sum.totalCents ?? 0,
    itemCountPaid: aggregateRows.reduce((sum, row) => sum + row.quantity, 0),
    distributedItemCount: distributedItems,
    fullyDistributedOrderCount: fullyDistributed,
    ordersByDay: [...byDay.entries()]
      .map(([day, value]) => ({ day, label: DAY_LABEL_FORMAT.format(new Date(`${day}T12:00:00Z`)), ...value }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    topVariants: aggregateRows
      .map((row) => ({ label: `${row.productName} · ${row.variantLabel}`, quantity: row.quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8),
  };
}
