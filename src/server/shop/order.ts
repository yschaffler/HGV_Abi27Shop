import 'server-only';
import { prisma } from '../db';
import { createOrderNumber, createPublicToken } from '../crypto/tokens';
import { getOrderWindow } from '../settings';
import { loadVariantsForPricing } from './catalog';
import { evaluateOrderWindow } from './order-window';
import { priceCart, type PricedCart } from './pricing';
import type { CheckoutInput } from '@/lib/validation/order';

/**
 * Anlegen einer Bestellung.
 *
 * Reihenfolge ist entscheidend und bewusst so gewählt:
 *   1. Bestellzeitraum prüfen  (nicht das Formular, sondern der Server entscheidet)
 *   2. Varianten aus der Datenbank laden
 *   3. Preise berechnen         (ausschließlich aus DB-Werten)
 *   4. Bestellung + Positionen in EINER Transaktion mit Preis-Snapshot schreiben
 *
 * Der Zahlungsstatus ist dabei immer PENDING. Auf PAID kommt eine Bestellung ausschließlich
 * über den signaturgeprüften Stripe-Webhook.
 */

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: string; publicToken: string; cart: PricedCart }
  | { ok: false; code: 'WINDOW_CLOSED' | 'PRICING' | 'INTERNAL'; message: string };

const MAX_ORDER_NUMBER_ATTEMPTS = 5;

export async function createPendingOrder(input: CheckoutInput): Promise<CreateOrderResult> {
  const window = await getOrderWindow();
  const status = evaluateOrderWindow(window);

  if (!status.isOpen) {
    return {
      ok: false,
      code: 'WINDOW_CLOSED',
      message:
        status.state === 'NOT_STARTED'
          ? 'Der Bestellzeitraum hat noch nicht begonnen.'
          : 'Der Bestellzeitraum ist abgelaufen. Es können keine Bestellungen mehr aufgegeben werden.',
    };
  }

  const variantIds = [...new Set(input.items.map((item) => item.variantId))];
  const catalog = await loadVariantsForPricing(variantIds);

  const pricing = priceCart(input.items, catalog);
  if (!pricing.ok) {
    return { ok: false, code: 'PRICING', message: pricing.message };
  }

  const { cart } = pricing;

  // Die Bestellnummer ist zufällig; bei einer Kollision im Unique-Index einfach neu würfeln.
  for (let attempt = 0; attempt < MAX_ORDER_NUMBER_ATTEMPTS; attempt += 1) {
    const orderNumber = createOrderNumber();
    const publicToken = createPublicToken();

    try {
      const order = await prisma.order.create({
        data: {
          orderNumber,
          publicToken,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          className: input.className,
          totalCents: cart.totalCents,
          items: {
            create: cart.lines.map((line) => ({
              variantId: line.variantId,
              productName: line.productName,
              variantLabel: line.variantLabel,
              color: line.color,
              size: line.size,
              unitPriceCents: line.unitPriceCents,
              quantity: line.quantity,
              lineTotalCents: line.lineTotalCents,
            })),
          },
        },
        select: { id: true, orderNumber: true, publicToken: true },
      });

      return { ok: true, orderId: order.id, orderNumber: order.orderNumber, publicToken: order.publicToken, cart };
    } catch (error) {
      if (isUniqueConstraintError(error) && attempt < MAX_ORDER_NUMBER_ATTEMPTS - 1) continue;
      throw error;
    }
  }

  return { ok: false, code: 'INTERNAL', message: 'Die Bestellung konnte nicht angelegt werden.' };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export const orderWithItemsInclude = {
  items: {
    orderBy: [{ productName: 'asc' as const }, { variantLabel: 'asc' as const }],
  },
};

/**
 * Einziger öffentlicher Weg zu einer Bestellung. Der Token ist das Geheimnis;
 * es gibt keinen Zugriff über eine ID oder die Bestellnummer.
 */
export async function findOrderByPublicToken(token: string) {
  return prisma.order.findUnique({
    where: { publicToken: token },
    include: orderWithItemsInclude,
  });
}
