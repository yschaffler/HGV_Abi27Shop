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

function paymentMethodTypes(): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] | undefined {
  const configured = env().STRIPE_PAYMENT_METHOD_TYPES?.trim();
  if (!configured) return undefined;

  return configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) as Stripe.Checkout.SessionCreateParams.PaymentMethodType[];
}

export async function createCheckoutSession(params: {
  orderId: string;
  orderNumber: string;
  publicToken: string;
  email: string;
  cart: PricedCart;
}): Promise<CheckoutSessionResult> {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = params.cart.lines.map((line) => ({
    quantity: line.quantity,
    price_data: {
      currency: 'eur',
      unit_amount: line.unitPriceCents,
      product_data: {
        name: `${line.productName} · ${line.variantLabel}`,
      },
    },
  }));

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
