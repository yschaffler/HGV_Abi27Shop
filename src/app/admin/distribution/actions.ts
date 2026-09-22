'use server';

import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { idSchema } from '@/lib/validation/admin';
import { authorize, ROLES_WITH_DISTRIBUTION_ACCESS } from '@/server/auth/rbac';
import { prisma } from '@/server/db';
import { assertSameOrigin } from '@/server/request-context';
import {
  distributeAllItems,
  distributeItem,
  getOrderForDistribution,
} from '@/server/shop/distribution';
import { logUnexpected } from '@/server/logger';

/**
 * Actions der Ausgabeansicht.
 *
 * Auch hier gilt: Die Rolle wird in JEDER Action geprüft, nicht nur beim Aufbau der Seite.
 * Ein Ausgabe-Konto erreicht ausschließlich diese drei Funktionen.
 */

export type DistributionOrderView = {
  id: string;
  orderNumber: string;
  firstName: string;
  lastName: string;
  distributionStatus: string;
  items: Array<{
    id: string;
    productName: string;
    variantLabel: string;
    quantity: number;
    distributionStatus: string;
    distributedAt: string | null;
  }>;
};

export type LoadOrderResult =
  | { ok: true; order: DistributionOrderView }
  | { ok: false; message: string };

export async function loadOrderAction(orderId: string): Promise<LoadOrderResult> {
  const auth = await authorize(ROLES_WITH_DISTRIBUTION_ACCESS);
  if (!auth.ok) return { ok: false, message: auth.error };

  const parsed = idSchema.safeParse(orderId);
  if (!parsed.success) return { ok: false, message: 'Ungültige Bestellung.' };

  try {
    const order = await getOrderForDistribution(parsed.data);
    if (!order) return { ok: false, message: 'Bestellung nicht gefunden oder nicht bezahlt.' };

    return {
      ok: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        firstName: order.firstName,
        lastName: order.lastName,
        distributionStatus: order.distributionStatus,
        items: order.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          variantLabel: item.variantLabel,
          quantity: item.quantity,
          distributionStatus: item.distributionStatus,
          distributedAt: item.distributedAt?.toISOString() ?? null,
        })),
      },
    };
  } catch (error) {
    const errorId = logUnexpected('loadOrderAction', error);
    return { ok: false, message: `Laden fehlgeschlagen. (Kennung ${errorId})` };
  }
}

export type DistributeResult =
  | { ok: true; order: DistributionOrderView; notice: string | null }
  | { ok: false; message: string };

async function reload(orderId: string, notice: string | null): Promise<DistributeResult> {
  const result = await loadOrderAction(orderId);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, order: result.order, notice };
}

export async function distributeItemAction(itemId: string): Promise<DistributeResult> {
  const origin = await assertSameOrigin();
  if (!origin.ok) return { ok: false, message: origin.message };

  const auth = await authorize(ROLES_WITH_DISTRIBUTION_ACCESS);
  if (!auth.ok) return { ok: false, message: auth.error };

  const parsed = idSchema.safeParse(itemId);
  if (!parsed.success) return { ok: false, message: 'Ungültige Position.' };

  const limit = checkRateLimit(`distribute:${auth.user.id}`, RATE_LIMITS.distributionAction);
  if (!limit.allowed) return { ok: false, message: 'Zu viele Aktionen in kurzer Zeit. Kurz warten.' };

  try {
    const outcome = await distributeItem(parsed.data, auth.user);
    if (!outcome.ok) return { ok: false, message: outcome.message };

    const item = await prisma.orderItem.findUnique({
      where: { id: parsed.data },
      select: { orderId: true },
    });
    if (!item) return { ok: false, message: 'Bestellung nicht gefunden.' };

    return reload(
      item.orderId,
      outcome.alreadyDistributed ? 'Dieser Artikel war bereits ausgegeben.' : null,
    );
  } catch (error) {
    const errorId = logUnexpected('distributeItemAction', error);
    return { ok: false, message: `Ausgabe fehlgeschlagen. (Kennung ${errorId})` };
  }
}

export async function distributeAllAction(orderId: string): Promise<DistributeResult> {
  const origin = await assertSameOrigin();
  if (!origin.ok) return { ok: false, message: origin.message };

  const auth = await authorize(ROLES_WITH_DISTRIBUTION_ACCESS);
  if (!auth.ok) return { ok: false, message: auth.error };

  const parsed = idSchema.safeParse(orderId);
  if (!parsed.success) return { ok: false, message: 'Ungültige Bestellung.' };

  const limit = checkRateLimit(`distribute:${auth.user.id}`, RATE_LIMITS.distributionAction);
  if (!limit.allowed) return { ok: false, message: 'Zu viele Aktionen in kurzer Zeit. Kurz warten.' };

  try {
    const outcome = await distributeAllItems(parsed.data, auth.user);
    if (!outcome.ok) return { ok: false, message: outcome.message };

    return reload(
      parsed.data,
      outcome.alreadyDistributed ? 'Es war bereits alles ausgegeben.' : null,
    );
  } catch (error) {
    const errorId = logUnexpected('distributeAllAction', error);
    return { ok: false, message: `Ausgabe fehlgeschlagen. (Kennung ${errorId})` };
  }
}
