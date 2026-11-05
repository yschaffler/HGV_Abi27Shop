import 'server-only';
import type Stripe from 'stripe';
import { prisma } from '../db';
import { logger } from '../logger';
import { sendOrderConfirmation, type ConfirmationResult } from '../mail/order-confirmation';

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
 *
 * Schlägt die Verarbeitung mit einem Fehler fehl, wird der Event-Eintrag wieder entfernt.
 * Sonst hielte der Replay-Schutz die erneute Zustellung von Stripe für ein Duplikat, und
 * die Zahlung bliebe dauerhaft unverbucht.
 *
 * Die Buchung einer bezahlten Session (`applyPaidCheckoutSession`) nutzt auch der manuelle
 * Abgleich in reconcile.ts – mit denselben Prüfungen.
 */

export type WebhookProcessResult = {
  status: 'processed' | 'duplicate' | 'ignored' | 'mismatch';
  detail: string;
  /** Nur bei einer frisch verbuchten Zahlung: was aus der Bestätigungsmail wurde. */
  mail?: ConfirmationResult;
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

  let result: WebhookProcessResult;
  try {
    result = await dispatch(event);
  } catch (error) {
    // Freigeben, damit Stripes nächster Zustellversuch das Event wirklich verarbeitet.
    await prisma.stripeWebhookEvent.delete({ where: { id: event.id } }).catch(() => undefined);
    throw error;
  }

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
      return applyPaidCheckoutSession(session);
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
      // Bewusst KEIN Statuswechsel: In Stripe Checkout bleibt die Session nach einer
      // abgelehnten Karte offen, und die Person kann es direkt mit einer anderen Karte noch
      // einmal versuchen. Früher wurde die Bestellung hier auf FAILED gesetzt – die danach
      // erfolgreiche Zahlung lief dann ins Leere, und die Bestätigungsmail blieb aus.
      // Endgültig ist erst checkout.session.expired oder async_payment_failed.
      const intent = event.data.object;
      return { status: 'ignored', detail: `Zahlungsversuch abgelehnt (${intent.id}), Session bleibt offen` };
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

/** Status, aus denen eine von Stripe bestätigte Zahlung die Bestellung auf PAID setzt. */
const PAYABLE_STATUSES = ['PENDING', 'FAILED', 'CANCELLED'] as const;

export async function applyPaidCheckoutSession(session: Stripe.Checkout.Session): Promise<WebhookProcessResult> {
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

  // Bedingtes Update: nur aus einem unbezahlten Status heraus. Ein später eintreffendes Event
  // trifft 0 Zeilen, und genau der Aufruf, der umstellt, verschickt die Mail – auch wenn
  // Webhook und manueller Abgleich gleichzeitig laufen.
  //
  // FAILED und CANCELLED gehören dazu: Hat Stripe das Geld nachweislich eingezogen (Session
  // passt, Betrag passt), ist die Bestellung bezahlt – auch wenn vorher ein Fehlversuch oder
  // eine Abbruchmeldung eingegangen ist. Erstattete Bestellungen bleiben unberührt.
  const updated = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: { in: [...PAYABLE_STATUSES] } },
    data: {
      paymentStatus: 'PAID',
      paidAt: new Date(),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
  });

  if (updated.count === 0) {
    return { status: 'ignored', detail: `Bestellung stand bereits auf ${order.paymentStatus}` };
  }

  logger.info('Bestellung als bezahlt markiert', {
    orderNumber: order.orderNumber,
    amountCents: order.totalCents,
    previousStatus: order.paymentStatus,
  });

  // Mailversand darf die Buchung nicht gefährden: Fehler werden geloggt, nicht geworfen.
  // Fehlt die Mail danach, zeigt der Adminbereich das an und kann sie nachsenden.
  let mail: ConfirmationResult;
  try {
    mail = await sendOrderConfirmation(order.id);
  } catch (error) {
    mail = 'failed';
    logger.error('Bestätigungsmail nach Zahlung fehlgeschlagen', { orderNumber: order.orderNumber, error });
  }

  return { status: 'processed', detail: `${order.orderNumber} -> PAID, Mail: ${mail}`, mail };
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
