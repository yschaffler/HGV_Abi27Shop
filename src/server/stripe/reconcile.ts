import 'server-only';
import { prisma } from '../db';
import { logger } from '../logger';
import { stripe } from './client';
import { applyPaidCheckoutSession } from './webhook';

/**
 * Abgleich einer Bestellung mit Stripe – für den Fall, dass ein Webhook ausbleibt.
 *
 * Webhooks kommen in aller Regel an, aber nicht garantiert: falsch eingetragenes Secret,
 * Server gerade neu gestartet, Stripe gibt nach mehreren Fehlversuchen auf. Dann steht eine
 * bezahlte Bestellung weiter auf "Zahlung ausstehend", und die Bestätigungsmail fehlt.
 *
 * Hier fragt der SERVER Stripe direkt nach der Checkout-Session. Das ist genauso
 * vertrauenswürdig wie der Webhook – die Antwort kommt authentifiziert von der Stripe-API,
 * nicht aus dem Browser. Gebucht wird über dieselbe Funktion wie beim Webhook, also mit
 * Session- und Betragsabgleich und dem bedingten Statuswechsel.
 */

export type ReconcileResult =
  | { status: 'paid_now'; detail: string; mailSent: boolean }
  | { status: 'already_paid' }
  | { status: 'not_paid'; detail: string }
  | { status: 'no_session' }
  | { status: 'mismatch'; detail: string }
  | { status: 'not_found' }
  | { status: 'stripe_error' };

export async function reconcileOrderPayment(orderId: string): Promise<ReconcileResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, paymentStatus: true, stripeCheckoutSessionId: true },
  });

  if (!order) return { status: 'not_found' };
  if (order.paymentStatus === 'PAID') return { status: 'already_paid' };
  if (!order.stripeCheckoutSessionId) return { status: 'no_session' };

  let session;
  try {
    session = await stripe().checkout.sessions.retrieve(order.stripeCheckoutSessionId);
  } catch (error) {
    logger.warn('Abgleich mit Stripe fehlgeschlagen', {
      orderNumber: order.orderNumber,
      error: error instanceof Error ? error.message : 'unbekannt',
    });
    return { status: 'stripe_error' };
  }

  if (session.payment_status !== 'paid') {
    return { status: 'not_paid', detail: `Stripe meldet: ${session.status ?? 'unbekannt'} / ${session.payment_status}` };
  }

  const result = await applyPaidCheckoutSession(session);
  logger.info('Bestellung mit Stripe abgeglichen', { orderNumber: order.orderNumber, result: result.status });

  switch (result.status) {
    case 'processed':
      return { status: 'paid_now', detail: result.detail, mailSent: result.mail === 'sent' };
    case 'mismatch':
      return { status: 'mismatch', detail: result.detail };
    default:
      // Zwischen Lesen und Buchen kann der Webhook schneller gewesen sein.
      return { status: 'already_paid' };
  }
}

/**
 * Gleicht alle offenen Bestellungen ab, die eine Checkout-Session haben. Für den
 * Adminbereich: nach einem Webhook-Ausfall mit einem Klick alles nachholen.
 *
 * Nacheinander statt parallel, damit Stripes Rate Limit nicht anschlägt. Bei einer
 * Sammelbestellung sind das wenige Dutzend Abfragen.
 */
export async function reconcileOpenOrders(): Promise<{ checked: number; paidNow: number; errors: number }> {
  const open = await prisma.order.findMany({
    where: { paymentStatus: { in: ['PENDING', 'FAILED'] }, stripeCheckoutSessionId: { not: null } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  let paidNow = 0;
  let errors = 0;
  for (const order of open) {
    // Eine einzelne kaputte Bestellung darf den Abgleich der übrigen nicht abbrechen.
    try {
      const result = await reconcileOrderPayment(order.id);
      if (result.status === 'paid_now') paidNow += 1;
      if (result.status === 'stripe_error' || result.status === 'mismatch') errors += 1;
    } catch (error) {
      errors += 1;
      logger.error('Abgleich einer Bestellung fehlgeschlagen', { orderId: order.id, error });
    }
  }

  return { checked: open.length, paidNow, errors };
}
