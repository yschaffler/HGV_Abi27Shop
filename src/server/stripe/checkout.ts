import 'server-only';
import type Stripe from 'stripe';
import { prisma } from '../db';
import { appUrl, env } from '../env';
import { logger } from '../logger';
import { stripe } from './client';
import type { PricedCart } from '../shop/pricing';

/**
 * Erzeugt eine Stripe-Checkout-Session.
 *
 * Die Positionen werden aus dem serverseitig berechneten Warenkorb gebildet – nicht aus
 * irgendetwas, das der Browser geschickt hat. Damit stimmt der bei Stripe belastete Betrag
 * immer mit dem in unserer Datenbank gespeicherten Betrag überein.
 *
 * Zahlungsarten: Ist STRIPE_PAYMENT_METHOD_TYPES leer, entscheidet Stripe anhand der
 * Einstellungen im Dashboard, welche Methoden angeboten werden (Karte, PayPal, ...).
 * Das ist der empfohlene Weg, weil PayPal je nach Konto und Land verfügbar ist oder nicht.
 */

/** Eine unbezahlte Session verfällt nach 30 Minuten. Stripe erlaubt minimal 30 Minuten. */
const SESSION_LIFETIME_SECONDS = 30 * 60;

export type CheckoutSessionResult = {
  url: string;
  sessionId: string;
};

export type ResumeResult =
  | { ok: true; url: string }
  | { ok: false; code: 'NOT_PENDING' | 'ALREADY_PAID' | 'NO_ITEMS' | 'STRIPE'; message: string };

function paymentMethodTypes(): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] | undefined {
  const configured = env().STRIPE_PAYMENT_METHOD_TYPES?.trim();
  if (!configured) return undefined;

  return configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) as Stripe.Checkout.SessionCreateParams.PaymentMethodType[];
}

type LineSnapshot = {
  productName: string;
  variantLabel: string;
  unitPriceCents: number;
  quantity: number;
};

function toLineItems(lines: LineSnapshot[]): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return lines.map((line) => ({
    quantity: line.quantity,
    price_data: {
      currency: 'eur',
      unit_amount: line.unitPriceCents,
      product_data: {
        name: `${line.productName} · ${line.variantLabel}`,
      },
    },
  }));
}

export async function createCheckoutSession(params: {
  orderId: string;
  orderNumber: string;
  publicToken: string;
  email: string;
  cart: PricedCart;
}): Promise<CheckoutSessionResult> {
  const lineItems = toLineItems(params.cart.lines);

  const session = await stripe().checkout.sessions.create(
    {
      mode: 'payment',
      line_items: lineItems,
      customer_email: params.email,
      client_reference_id: params.orderId,
      // Über diese Metadaten findet der Webhook die Bestellung wieder.
      metadata: { orderId: params.orderId, orderNumber: params.orderNumber },
      payment_intent_data: {
        metadata: { orderId: params.orderId, orderNumber: params.orderNumber },
        description: `Abi-Shop Bestellung ${params.orderNumber}`,
      },
      ...(paymentMethodTypes() ? { payment_method_types: paymentMethodTypes() } : {}),
      locale: 'de',
      expires_at: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
      success_url: appUrl(`/bestellung/${params.publicToken}?zahlung=erfolgreich`),
      cancel_url: appUrl(`/bestellung/${params.publicToken}?zahlung=abgebrochen`),
    },
    {
      // Ein doppelter Klick oder ein Netzwerk-Retry erzeugt keine zweite Session.
      idempotencyKey: `checkout:${params.orderId}`,
    },
  );

  if (!session.url) {
    throw new Error('Stripe hat keine Checkout-URL geliefert');
  }

  await prisma.order.update({
    where: { id: params.orderId },
    data: { stripeCheckoutSessionId: session.id },
  });

  logger.info('Checkout-Session erstellt', {
    orderNumber: params.orderNumber,
    sessionId: session.id,
    amountCents: params.cart.totalCents,
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Erzeugt eine neue Checkout-Session fuer eine bereits angelegte, noch unbezahlte Bestellung.
 *
 * Gedacht fuer den Fall, dass jemand die Zahlung abbricht oder die Session nach 30 Minuten
 * verfaellt. Die Bestellung bleibt bestehen, es wird nur ein neuer Bezahlvorgang gestartet.
 *
 * Drei Dinge sind dabei wichtig:
 *
 * 1. Die Positionen kommen aus dem **Preis-Snapshot der Bestellung**, nicht aus dem aktuellen
 *    Katalog. Wer gestern zu 44,90 EUR bestellt hat, zahlt auch dann 44,90 EUR, wenn der
 *    Preis inzwischen geaendert wurde. Der Betrag passt damit weiterhin zu totalCents, und
 *    der Abgleich im Webhook geht auf.
 *
 * 2. Die alte Session wird bei Stripe **verfallen gelassen**. Sonst koennte jemand mit einem
 *    alten Tab doch noch die erste Session bezahlen – der Webhook wuerde sie wegen der nicht
 *    mehr passenden Session-ID ablehnen, und das Geld laege bei Stripe ohne Bestellung.
 *
 * 3. Vorher wird geprueft, ob die alte Session nicht doch schon bezahlt ist. Sonst wuerde
 *    hier eine zweite Zahlung fuer dieselbe Bestellung eroeffnet.
 */
export async function resumeCheckoutSession(orderId: string): Promise<ResumeResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      publicToken: true,
      email: true,
      totalCents: true,
      paymentStatus: true,
      paymentAttempts: true,
      stripeCheckoutSessionId: true,
      items: {
        orderBy: [{ productName: 'asc' }, { variantLabel: 'asc' }],
        select: { productName: true, variantLabel: true, unitPriceCents: true, quantity: true },
      },
    },
  });

  if (!order) return { ok: false, code: 'NOT_PENDING', message: 'Bestellung nicht gefunden.' };

  if (order.paymentStatus !== 'PENDING') {
    return {
      ok: false,
      code: order.paymentStatus === 'PAID' ? 'ALREADY_PAID' : 'NOT_PENDING',
      message:
        order.paymentStatus === 'PAID'
          ? 'Diese Bestellung ist bereits bezahlt.'
          : 'Diese Bestellung kann nicht mehr bezahlt werden.',
    };
  }

  if (order.items.length === 0) {
    return { ok: false, code: 'NO_ITEMS', message: 'Diese Bestellung enthaelt keine Positionen.' };
  }

  if (order.stripeCheckoutSessionId) {
    try {
      const previous = await stripe().checkout.sessions.retrieve(order.stripeCheckoutSessionId);

      // Bezahlt, aber der Webhook ist noch unterwegs: auf keinen Fall ein zweites Mal kassieren.
      if (previous.payment_status === 'paid' || previous.status === 'complete') {
        return {
          ok: false,
          code: 'ALREADY_PAID',
          message: 'Die Zahlung ist bereits bei unserem Zahlungsdienstleister eingegangen und wird gerade bestaetigt.',
        };
      }

      if (previous.status === 'open') {
        await stripe().checkout.sessions.expire(order.stripeCheckoutSessionId);
      }
    } catch (error) {
      logger.warn('Alte Checkout-Session konnte nicht geprueft werden', {
        orderNumber: order.orderNumber,
        error: error instanceof Error ? error.message : 'unbekannt',
      });
      return {
        ok: false,
        code: 'STRIPE',
        message: 'Die bisherige Zahlung konnte nicht geprueft werden. Bitte spaeter erneut versuchen.',
      };
    }
  }

  const attempt = order.paymentAttempts + 1;

  const session = await stripe().checkout.sessions.create(
    {
      mode: 'payment',
      line_items: toLineItems(order.items),
      customer_email: order.email,
      client_reference_id: order.id,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
      payment_intent_data: {
        metadata: { orderId: order.id, orderNumber: order.orderNumber },
        description: `Abi-Shop Bestellung ${order.orderNumber}`,
      },
      ...(paymentMethodTypes() ? { payment_method_types: paymentMethodTypes() } : {}),
      locale: 'de',
      expires_at: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
      success_url: appUrl(`/bestellung/${order.publicToken}?zahlung=erfolgreich`),
      cancel_url: appUrl(`/bestellung/${order.publicToken}?zahlung=abgebrochen`),
    },
    {
      // Der Versuchszaehler gehoert in den Schluessel: Sonst gaebe Stripe die bereits
      // verfallene Session des ersten Versuchs zurueck.
      idempotencyKey: `checkout:${order.id}:${attempt}`,
    },
  );

  if (!session.url) {
    return { ok: false, code: 'STRIPE', message: 'Der Zahlungsdienstleister hat keine Adresse geliefert.' };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeCheckoutSessionId: session.id, paymentAttempts: attempt },
  });

  logger.info('Zahlung wird fortgesetzt', {
    orderNumber: order.orderNumber,
    sessionId: session.id,
    attempt,
    amountCents: order.totalCents,
  });

  return { ok: true, url: session.url };
}
