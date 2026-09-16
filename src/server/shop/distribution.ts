import 'server-only';
import { prisma } from '../db';
import { recordAudit } from '../audit';
import { deriveOrderDistributionStatus } from './distribution-status';
import type { AuthUser } from '../auth/session';

/**
 * Warenausgabe in der Schule.
 *
 * Zentrale Anforderung: An der Ausgabe stehen mehrere Leute mit mehreren iPads. Es darf
 * nicht passieren, dass zwei Personen denselben Artikel gleichzeitig "ausgeben" und ein
 * Pulli doppelt rausgeht. Deshalb wird nirgends gelesen-geprüft-geschrieben, sondern immer
 * bedingt geschrieben: `updateMany` mit `distributionStatus: NOT_DISTRIBUTED` in der
 * Bedingung. Wer als Zweiter klickt, trifft null Zeilen und bekommt einen Hinweis statt
 * einer zweiten Ausgabe.
 */

/** Wildcards entfernen, damit "%" nicht die gesamte Liste zieht. */
function sanitizeQuery(raw: string): string {
  return raw.trim().replace(/[%_\\]/g, ' ').replace(/\s+/g, ' ');
}

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_LIMIT = 12;

export type DistributionSearchHit = {
  id: string;
  orderNumber: string;
  firstName: string;
  lastName: string;
  className: string;
  distributionStatus: string;
  itemCount: number;
  distributedCount: number;
};

/**
 * Autocomplete für die Ausgabe. Es werden ausschließlich bezahlte Bestellungen gefunden –
 * was nicht bezahlt ist, wird auch nicht ausgegeben.
 */
export async function searchPaidOrders(rawQuery: string): Promise<DistributionSearchHit[]> {
  const query = sanitizeQuery(rawQuery);
  if (query.length < SEARCH_MIN_LENGTH) return [];

  // "Max Mus" soll Max Mustermann finden: jeder Begriff muss irgendwo im Namen vorkommen.
  const terms = query.split(' ').filter(Boolean).slice(0, 4);

  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: 'PAID',
      OR: [
        { AND: terms.map((term) => ({ OR: [{ firstName: { contains: term } }, { lastName: { contains: term } }] })) },
        { orderNumber: { contains: query.replace(/\s/g, '') } },
      ],
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: SEARCH_LIMIT,
    select: {
      id: true,
      orderNumber: true,
      firstName: true,
      lastName: true,
      className: true,
      distributionStatus: true,
      items: { select: { distributionStatus: true } },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    firstName: order.firstName,
    lastName: order.lastName,
    className: order.className,
    distributionStatus: order.distributionStatus,
    itemCount: order.items.length,
    distributedCount: order.items.filter((item) => item.distributionStatus === 'DISTRIBUTED').length,
  }));
}

export async function getOrderForDistribution(orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, paymentStatus: 'PAID' },
    select: {
      id: true,
      orderNumber: true,
      firstName: true,
      lastName: true,
      className: true,
      distributionStatus: true,
      totalCents: true,
      items: {
        orderBy: [{ productName: 'asc' }, { variantLabel: 'asc' }],
        select: {
          id: true,
          productName: true,
          variantLabel: true,
          quantity: true,
          distributionStatus: true,
          distributedAt: true,
        },
      },
    },
  });
}

export type DistributionOutcome =
  | { ok: true; changed: number; orderStatus: string; alreadyDistributed: boolean }
  | { ok: false; message: string };

/**
 * Aktualisiert den Gesamtstatus der Bestellung aus ihren Positionen – immer innerhalb
 * derselben Transaktion wie die Positionsänderung.
 */
async function syncOrderStatus(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  orderId: string,
): Promise<string> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { distributionStatus: true },
  });

  const status = deriveOrderDistributionStatus(items);

  await tx.order.update({
    where: { id: orderId },
    data: {
      distributionStatus: status,
      distributionCompletedAt: status === 'FULLY_DISTRIBUTED' ? new Date() : null,
    },
  });

  return status;
}

export async function distributeItem(itemId: string, actor: AuthUser): Promise<DistributionOutcome> {
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: { id: true, orderId: true, productName: true, variantLabel: true, order: { select: { orderNumber: true, paymentStatus: true } } },
  });

  if (!item) return { ok: false, message: 'Position nicht gefunden.' };
  if (item.order.paymentStatus !== 'PAID') {
    return { ok: false, message: 'Diese Bestellung ist nicht bezahlt und darf nicht ausgegeben werden.' };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.orderItem.updateMany({
      // Die Statusbedingung ist der eigentliche Schutz gegen doppelte Ausgabe.
      where: { id: itemId, distributionStatus: 'NOT_DISTRIBUTED' },
      data: {
        distributionStatus: 'DISTRIBUTED',
        distributedAt: new Date(),
        distributedByUserId: actor.id,
      },
    });

    const orderStatus = await syncOrderStatus(tx, item.orderId);
    return { changed: updated.count, orderStatus };
  });

  if (result.changed === 0) {
    return { ok: true, changed: 0, orderStatus: result.orderStatus, alreadyDistributed: true };
  }

  await recordAudit({
    actor: { id: actor.id, email: actor.email },
    action: 'ITEM_DISTRIBUTED',
    entityType: 'OrderItem',
    entityId: itemId,
    summary: `${item.order.orderNumber}: ${item.productName} (${item.variantLabel}) ausgegeben`,
  });

  return { ok: true, changed: result.changed, orderStatus: result.orderStatus, alreadyDistributed: false };
}

/**
 * "Alles ausgeben": gibt nur die noch offenen Positionen aus. Bereits ausgegebene Artikel
 * bleiben unverändert und werden nicht erneut als ausgegeben protokolliert.
 */
export async function distributeAllItems(orderId: string, actor: AuthUser): Promise<DistributionOutcome> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, paymentStatus: true },
  });

  if (!order) return { ok: false, message: 'Bestellung nicht gefunden.' };
  if (order.paymentStatus !== 'PAID') {
    return { ok: false, message: 'Diese Bestellung ist nicht bezahlt und darf nicht ausgegeben werden.' };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.orderItem.updateMany({
      where: { orderId, distributionStatus: 'NOT_DISTRIBUTED' },
      data: {
        distributionStatus: 'DISTRIBUTED',
        distributedAt: new Date(),
        distributedByUserId: actor.id,
      },
    });

    const orderStatus = await syncOrderStatus(tx, orderId);
    return { changed: updated.count, orderStatus };
  });

  if (result.changed === 0) {
    return { ok: true, changed: 0, orderStatus: result.orderStatus, alreadyDistributed: true };
  }

  await recordAudit({
    actor: { id: actor.id, email: actor.email },
    action: 'ORDER_DISTRIBUTED_ALL',
    entityType: 'Order',
    entityId: orderId,
    summary: `${order.orderNumber}: ${result.changed} Position(en) ausgegeben`,
  });

  return { ok: true, changed: result.changed, orderStatus: result.orderStatus, alreadyDistributed: false };
}
