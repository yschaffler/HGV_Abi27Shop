import 'server-only';
import type Stripe from 'stripe';
import { prisma } from '../db';
import { logger } from '../logger';
import { sendOrderConfirmation } from '../mail/order-confirmation';

/**
 * Verarbeitung der Stripe-Webhooks.
 *
 * Drei Eigenschaften sind hier entscheidend:
 *
 * 1. IDEMPOTENZ – Jede Event-ID wird als Primärschlüssel in stripe_webhook_events
 *    eingefügt. Ein zweiter Zustellversuch läuft in den Unique-Constraint und macht nichts.
 *    Stripe stellt Events garantiert mindestens einmal zu, also durchaus auch mehrfach.
 *
 * 2. BEDINGTE STATUSUEBERGAENGE – Statusänderungen laufen als `updateMany` mit dem erwarteten
 *    Ausgangsstatus in der WHERE-Bedingung. Kein Lesen-Prüfen-Schreiben, also keine
 *    Race Condition zwischen zwei gleichzeitig eintreffenden Events.
 *
 * 3. BETRAGSABGLEICH – Bezahlt wird nur, was betragsmäßig zur gespeicherten Bestellung passt.
 *    Weicht der Betrag ab, wird nichts umgestellt und laut geloggt: Das ist entweder ein Bug
 *    oder ein Manipulationsversuch, und beides will man sehen statt stillschweigend buchen.
 */

export type WebhookProcessResult = {
  status: 'processed' | 'duplicate' | 'ignored' | 'mismatch';
  detail: string;
};

/** Events, auf die wir reagieren. Alles andere wird bewusst ignoriert. */
const HANDLED_EVENTS = new Set<Stripe.Event.Type>([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
  'charge.refunded',
]);

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export async function processStripeEvent(event: Stripe.Event): Promise<WebhookProcessResult> {
  // Schritt 1: Replay-Schutz. Muss vor jeder Wirkung passieren.
  try {
    await prisma.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      logger.info('Stripe-Event bereits verarbeitet, wird ignoriert', { eventId: event.id, type: event.type });
      return { status: 'duplicate', detail: 'bereits verarbeitet' };
    }
    throw error;
  }

  const result = await dispatch(event);

  await prisma.stripeWebhookEvent.update({
    where: { id: event.id },
    data: { processedAt: new Date(), result: `${result.status}: ${result.detail}`.slice(0, 500) },
  });

  return result;
}

async function dispatch(event: Stripe.Event): Promise<WebhookProcessResult> {
  if (!HANDLED_EVENTS.has(event.type)) {
    return { status: 'ignored', detail: `Event-Typ ${event.type} wird nicht ausgewertet` };
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      // Bei asynchronen Zahlarten ist die Session zwar abgeschlossen, aber noch nicht bezahlt.
      // Dann kommt später ein async_payment_succeeded – bis dahin bleibt alles PENDING.
      if (session.payment_status !== 'paid') {
        return { status: 'ignored', detail: `payment_status=${session.payment_status}, warte auf Zahlungseingang` };
      }
      return markPaid(session);
    }

    case 'checkout.session.async_payment_failed': {
      const session = event.data.object;
      return setFailed(orderIdFromSession(session), 'Zahlung fehlgeschlagen');
    }

    case 'checkout.session.expired': {
      const session = event.data.object;
      return setCancelled(orderIdFromSession(session));
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object;
      return setFailed(intent.metadata?.['orderId'] ?? null, 'Zahlung fehlgeschlagen');
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      return markRefunded(charge);
    }

    default:
      return { status: 'ignored', detail: `Event-Typ ${event.type} wird nicht ausgewertet` };
  }
}

function orderIdFromSession(session: Stripe.Checkout.Session): string | null {
  return session.metadata?.['orderId'] ?? session.client_reference_id ?? null;
}

async function markPaid(session: Stripe.Checkout.Session): Promise<WebhookProcessResult> {
  const orderId = orderIdFromSession(session);
  if (!orderId) return { status: 'ignored', detail: 'Session ohne orderId' };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, totalCents: true, paymentStatus: true, stripeCheckoutSessionId: true },
  });

  if (!order) {
    logger.error('Stripe meldet Zahlung für unbekannte Bestellung', { orderId, sessionId: session.id });
    return { status: 'ignored', detail: 'Bestellung nicht gefunden' };
  }

  // Die Session muss zu genau der Session gehören, die wir für diese Bestellung erzeugt haben.
  if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
    logger.error('Session-ID passt nicht zur Bestellung', {
      orderNumber: order.orderNumber,
      expected: order.stripeCheckoutSessionId,
      received: session.id,
    });
    return { status: 'mismatch', detail: 'Session-ID passt nicht zur Bestellung' };
  }

  // Betragsabgleich: Es wird nur gebucht, was auch bestellt wurde.
  if (session.amount_total !== order.totalCents || session.currency?.toLowerCase() !== 'eur') {
    logger.error('Betrag oder Währung weichen von der Bestellung ab – Bestellung bleibt unbezahlt', {
      orderNumber: order.orderNumber,
      expectedCents: order.totalCents,
      receivedCents: session.amount_total,
      currency: session.currency,
    });
    return { status: 'mismatch', detail: 'Betrag weicht von der Bestellung ab, manuelle Prüfung nötig' };
  }

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

  // Bedingtes Update: nur PENDING -> PAID. Ein später eintreffendes Event trifft 0 Zeilen.
  const updated = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: 'PENDING' },
    data: {
      paymentStatus: 'PAID',
      paidAt: new Date(),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
  });

  if (updated.count === 0) {
    return { status: 'ignored', detail: `Bestellung stand bereits auf ${order.paymentStatus}` };
  }

  logger.info('Bestellung als bezahlt markiert', { orderNumber: order.orderNumber, amountCents: order.totalCents });

  // Mailversand darf die Webhook-Antwort nicht gefährden: Fehler werden geloggt, nicht geworfen.
  try {
    await sendOrderConfirmation(order.id);
  } catch (error) {
    logger.error('Bestätigungsmail nach Zahlung fehlgeschlagen', { orderNumber: order.orderNumber, error });
  }

  return { status: 'processed', detail: `${order.orderNumber} -> PAID` };
}

async function setFailed(orderId: string | null, reason: string): Promise<WebhookProcessResult> {
  if (!orderId) return { status: 'ignored', detail: 'Event ohne orderId' };

  const updated = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: 'PENDING' },
    data: { paymentStatus: 'FAILED' },
  });

  return updated.count > 0
    ? { status: 'processed', detail: `${reason} -> FAILED` }
    : { status: 'ignored', detail: 'Bestellung war nicht mehr offen' };
}

async function setCancelled(orderId: string | null): Promise<WebhookProcessResult> {
  if (!orderId) return { status: 'ignored', detail: 'Event ohne orderId' };

  const updated = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: 'PENDING' },
    data: { paymentStatus: 'CANCELLED' },
  });

  return updated.count > 0
    ? { status: 'processed', detail: 'Checkout abgelaufen -> CANCELLED' }
    : { status: 'ignored', detail: 'Bestellung war nicht mehr offen' };
}

async function markRefunded(charge: Stripe.Charge): Promise<WebhookProcessResult> {
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return { status: 'ignored', detail: 'Charge ohne PaymentIntent' };

  // Teilerstattungen ändern den Status nicht – nur eine vollständige Erstattung.
  if (charge.amount_refunded < charge.amount) {
    return { status: 'ignored', detail: 'Teilerstattung, Status bleibt unverändert' };
  }

  const updated = await prisma.order.updateMany({
    where: { stripePaymentIntentId: paymentIntentId, paymentStatus: 'PAID' },
    data: { paymentStatus: 'REFUNDED' },
  });

  return updated.count > 0
    ? { status: 'processed', detail: 'Erstattung -> REFUNDED' }
    : { status: 'ignored', detail: 'Keine passende bezahlte Bestellung' };
}
