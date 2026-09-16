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

export type ShopStatistics = {
  orderCount: number;
  paidOrderCount: number;
  pendingOrderCount: number;
  revenuePaidCents: number;
  itemCountPaid: number;
  distributedItemCount: number;
  fullyDistributedOrderCount: number;
  ordersByClass: Array<{ className: string; orders: number; revenueCents: number }>;
  topVariants: Array<{ label: string; quantity: number }>;
};

export async function loadStatistics(): Promise<ShopStatistics> {
  const [counts, paidAggregate, paidOrders, distributedItems, fullyDistributed, aggregateRows] =
    await Promise.all([
      prisma.order.groupBy({ by: ['paymentStatus'], _count: { _all: true } }),
      prisma.order.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { totalCents: true } }),
      prisma.order.findMany({
        where: { paymentStatus: 'PAID' },
        select: { className: true, totalCents: true },
      }),
      prisma.orderItem.count({
        where: { distributionStatus: 'DISTRIBUTED', order: { paymentStatus: 'PAID' } },
      }),
      prisma.order.count({ where: { paymentStatus: 'PAID', distributionStatus: 'FULLY_DISTRIBUTED' } }),
      loadAggregateRows(),
    ]);

  const countFor = (status: string): number =>
    counts.find((row) => row.paymentStatus === status)?._count._all ?? 0;

  const byClass = new Map<string, { orders: number; revenueCents: number }>();
  for (const order of paidOrders) {
    const entry = byClass.get(order.className) ?? { orders: 0, revenueCents: 0 };
    entry.orders += 1;
    entry.revenueCents += order.totalCents;
    byClass.set(order.className, entry);
  }

  return {
    orderCount: counts.reduce((sum, row) => sum + row._count._all, 0),
    paidOrderCount: countFor('PAID'),
    pendingOrderCount: countFor('PENDING'),
    revenuePaidCents: paidAggregate._sum.totalCents ?? 0,
    itemCountPaid: aggregateRows.reduce((sum, row) => sum + row.quantity, 0),
    distributedItemCount: distributedItems,
    fullyDistributedOrderCount: fullyDistributed,
    ordersByClass: [...byClass.entries()]
      .map(([className, value]) => ({ className, ...value }))
      .sort((a, b) => a.className.localeCompare(b.className, 'de')),
    topVariants: aggregateRows
      .map((row) => ({ label: `${row.productName} · ${row.variantLabel}`, quantity: row.quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8),
  };
}
