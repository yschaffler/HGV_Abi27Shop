import 'server-only';
import { prisma } from '../db';
import type { OrderFilter } from '@/lib/validation/admin';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Bestellübersicht für den Adminbereich.
 *
 * Suche und Filter laufen komplett über den Prisma-Query-Builder. Es wird an keiner Stelle
 * SQL zusammengesetzt – damit gibt es hier strukturell keine SQL-Injection.
 */

export const ORDERS_PAGE_SIZE = 25;

/** Wildcards entfernen: "%" würde sonst als LIKE-Platzhalter wirken. */
function sanitize(value: string): string {
  return value.replace(/[%_\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function buildOrderWhere(filter: OrderFilter): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  if (filter.zahlung) where.paymentStatus = filter.zahlung;
  if (filter.sammelbestellung) where.fulfillmentStatus = filter.sammelbestellung;
  if (filter.ausgabe) where.distributionStatus = filter.ausgabe;

  const search = filter.suche ? sanitize(filter.suche) : '';
  if (search.length > 0) {
    const terms = search.split(' ').filter(Boolean).slice(0, 4);
    where.OR = [
      { AND: terms.map((term) => ({ OR: [{ firstName: { contains: term } }, { lastName: { contains: term } }] })) },
      { orderNumber: { contains: search.replace(/\s/g, '') } },
      { email: { contains: search } },
    ];
  }

  return where;
}

export async function listOrders(filter: OrderFilter) {
  const where = buildOrderWhere(filter);
  const skip = (filter.seite - 1) * ORDERS_PAGE_SIZE;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: ORDERS_PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        totalCents: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        distributionStatus: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    total,
    page: filter.seite,
    pageCount: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)),
  };
}

export async function getOrderDetail(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        orderBy: [{ productName: 'asc' }, { variantLabel: 'asc' }],
        include: { distributedBy: { select: { name: true } } },
      },
    },
  });
}

