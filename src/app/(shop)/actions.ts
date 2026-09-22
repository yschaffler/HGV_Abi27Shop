'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertSameOrigin, clientIp } from '@/server/request-context';
import { logUnexpected } from '@/server/logger';
import { loadVariantsForPricing } from '@/server/shop/catalog';
import { createPendingOrder } from '@/server/shop/order';
import { evaluateOrderWindow } from '@/server/shop/order-window';
import { priceCart } from '@/server/shop/pricing';
import { getOrderWindow } from '@/server/settings';
import { createCheckoutSession, resumeCheckoutSession } from '@/server/stripe/checkout';
import { isStripeConfigured } from '@/server/stripe/client';
import { findOrderByPublicToken } from '@/server/shop/order';
import { cartSchema, checkoutSchema, publicTokenSchema } from '@/lib/validation/order';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Server Actions des öffentlichen Shops.
 *
 * Next.js prüft bei Server Actions von sich aus Origin und Host, damit ist CSRF für den
 * gesamten Schreibpfad abgedeckt. Zusätzlich gilt in jeder Action dieselbe Reihenfolge:
 * Rate Limit -> Zod-Validierung -> Fachlogik. Der Client liefert nie mehr als IDs und Mengen.
 */

export type CartViewLine = {
  variantId: string;
  productName: string;
  variantLabel: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type CartViewState =
  | { ok: true; lines: CartViewLine[]; totalCents: number; totalQuantity: number; removed: string[] }
  | { ok: false; message: string };

/**
 * Bepreist den Warenkorb des Browsers neu.
 *
 * Artikel, die es nicht mehr gibt oder die deaktiviert wurden, werden hier still entfernt und
 * in `removed` gemeldet – der Warenkorb soll deswegen nicht komplett blockieren. Die
 * eigentliche Bestellung prüft danach trotzdem noch einmal alles.
 */
export async function resolveCartAction(rawItems: unknown): Promise<CartViewState> {
  const parsed = cartSchema.safeParse(rawItems);

  if (!parsed.success) {
    // Leerer Warenkorb ist kein Fehler, sondern ein leerer Warenkorb.
    if (Array.isArray(rawItems) && rawItems.length === 0) {
      return { ok: true, lines: [], totalCents: 0, totalQuantity: 0, removed: [] };
    }
    return { ok: false, message: 'Der Warenkorb konnte nicht gelesen werden.' };
  }

  try {
    const catalog = await loadVariantsForPricing([...new Set(parsed.data.map((item) => item.variantId))]);
    const available = new Set(catalog.filter((variant) => variant.active && variant.productActive).map((v) => v.id));

    const keptItems = parsed.data.filter((item) => available.has(item.variantId));
    const removed = parsed.data.filter((item) => !available.has(item.variantId)).map((item) => item.variantId);

    if (keptItems.length === 0) {
      return { ok: true, lines: [], totalCents: 0, totalQuantity: 0, removed };
    }

    const pricing = priceCart(keptItems, catalog);
    if (!pricing.ok) return { ok: false, message: pricing.message };

    return {
      ok: true,
      lines: pricing.cart.lines.map((line) => ({
        variantId: line.variantId,
        productName: line.productName,
        variantLabel: line.variantLabel,
        unitPriceCents: line.unitPriceCents,
        quantity: line.quantity,
        lineTotalCents: line.lineTotalCents,
      })),
      totalCents: pricing.cart.totalCents,
      totalQuantity: pricing.cart.totalQuantity,
      removed,
    };
  } catch (error) {
    const errorId = logUnexpected('resolveCartAction', error);
    return { ok: false, message: `Der Warenkorb konnte nicht geladen werden. (Kennung ${errorId})` };
  }
}

export type CheckoutFormState = {
  status: 'idle' | 'error';
  message?: string;
  fieldErrors?: Partial<
    Record<
      'firstName' | 'lastName' | 'email' | 'acceptedTerms' | 'acceptedPickup' | 'items',
      string
    >
  >;
};

const itemsFieldSchema = z
  .string()
  .max(4000)
  .transform((value, ctx) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Der Warenkorb konnte nicht gelesen werden.' });
      return z.NEVER;
    }
  });

export async function submitCheckoutAction(
  _previous: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  const origin = await assertSameOrigin();
  if (!origin.ok) return { status: 'error', message: origin.message };

  const ip = await clientIp();
  const limit = checkRateLimit(`checkout:${ip}`, RATE_LIMITS.checkout);

  if (!limit.allowed) {
    return {
      status: 'error',
      message: `Zu viele Bestellversuche. Bitte in ${Math.ceil(limit.retryAfterSeconds / 60)} Minuten erneut versuchen.`,
    };
  }

  const itemsRaw = itemsFieldSchema.safeParse(formData.get('items') ?? '[]');
  if (!itemsRaw.success) {
    return { status: 'error', fieldErrors: { items: 'Der Warenkorb konnte nicht gelesen werden.' } };
  }

  const parsed = checkoutSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    acceptedTerms: formData.get('acceptedTerms') === 'on',
    acceptedPickup: formData.get('acceptedPickup') === 'on',
    items: itemsRaw.data,
  });

  if (!parsed.success) {
    const fieldErrors: CheckoutFormState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !(field in fieldErrors)) {
        Object.assign(fieldErrors, { [field]: issue.message });
      }
    }
    return { status: 'error', message: 'Bitte die markierten Felder prüfen.', fieldErrors };
  }

  if (!isStripeConfigured()) {
    return { status: 'error', message: 'Die Bezahlung ist derzeit nicht verfügbar. Bitte später erneut versuchen.' };
  }

  let checkoutUrl: string;

  try {
    // Der Bestellzeitraum wird hier erneut geprüft – nicht nur beim Rendern des Formulars.
    const window = evaluateOrderWindow(await getOrderWindow());
    if (!window.isOpen) {
      return {
        status: 'error',
        message:
          window.state === 'NOT_STARTED'
            ? 'Der Bestellzeitraum hat noch nicht begonnen.'
            : 'Der Bestellzeitraum ist abgelaufen. Es können keine Bestellungen mehr aufgegeben werden.',
      };
    }

    const order = await createPendingOrder(parsed.data);
    if (!order.ok) return { status: 'error', message: order.message };

    const session = await createCheckoutSession({
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      publicToken: order.publicToken,
      email: parsed.data.email,
      cart: order.cart,
    });

    checkoutUrl = session.url;
  } catch (error) {
    const errorId = logUnexpected('submitCheckoutAction', error);
    return {
      status: 'error',
      message: `Die Bestellung konnte nicht abgeschlossen werden. Bitte erneut versuchen. (Kennung ${errorId})`,
    };
  }

  // redirect() wirft intern – deshalb steht es außerhalb des try-Blocks.
  redirect(checkoutUrl);
}

export type ResumePaymentState = { status: 'idle' | 'error'; message?: string };

/**
 * Setzt eine abgebrochene oder verfallene Zahlung fort.
 *
 * Der oeffentliche Token ist hier das einzige Zugangsmerkmal – genau wie beim Anzeigen der
 * Bestellung. Wer den Token hat, darf die zugehoerige Bestellung bezahlen; das ist kein
 * zusaetzliches Risiko, weil dabei nur Geld in Richtung des Shops fliesst.
 *
 * Die Bestellung selbst wird nicht neu berechnet: Es zaehlt der Preis-Snapshot, der beim
 * Anlegen gespeichert wurde. Der Bestellzeitraum wird trotzdem erneut geprueft – nach dem
 * Bestellschluss geht die Sammelbestellung raus, danach nuetzt eine Zahlung niemandem mehr.
 */
export async function resumePaymentAction(
  _previous: ResumePaymentState,
  formData: FormData,
): Promise<ResumePaymentState> {
  const origin = await assertSameOrigin();
  if (!origin.ok) return { status: 'error', message: origin.message };

  const ip = await clientIp();
  const limit = checkRateLimit(`resume-payment:${ip}`, RATE_LIMITS.resumePayment);
  if (!limit.allowed) {
    return {
      status: 'error',
      message: `Zu viele Versuche. Bitte in ${Math.ceil(limit.retryAfterSeconds / 60)} Minuten erneut versuchen.`,
    };
  }

  const token = publicTokenSchema.safeParse(formData.get('token'));
  if (!token.success) return { status: 'error', message: 'Ungueltige Bestellreferenz.' };

  if (!isStripeConfigured()) {
    return { status: 'error', message: 'Die Bezahlung ist derzeit nicht verfügbar. Bitte später erneut versuchen.' };
  }

  let checkoutUrl: string;

  try {
    const order = await findOrderByPublicToken(token.data);
    if (!order) return { status: 'error', message: 'Bestellung nicht gefunden.' };

    const window = evaluateOrderWindow(await getOrderWindow());
    if (!window.isOpen) {
      return {
        status: 'error',
        message:
          'Der Bestellzeitraum ist beendet – die Sammelbestellung ist bereits raus. Bitte wendet euch an die Q-Sprecher.',
      };
    }

    const resumed = await resumeCheckoutSession(order.id);
    if (!resumed.ok) return { status: 'error', message: resumed.message };

    checkoutUrl = resumed.url;
  } catch (error) {
    const errorId = logUnexpected('resumePaymentAction', error);
    return {
      status: 'error',
      message: `Die Zahlung konnte nicht gestartet werden. Bitte erneut versuchen. (Kennung ${errorId})`,
    };
  }

  // redirect() wirft intern – deshalb steht es außerhalb des try-Blocks.
  redirect(checkoutUrl);
}
