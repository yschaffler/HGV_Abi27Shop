import { NextResponse } from 'next/server';
import { env } from '@/server/env';
import { logger, logUnexpected } from '@/server/logger';
import { stripe } from '@/server/stripe/client';
import { processStripeEvent } from '@/server/stripe/webhook';

/**
 * Stripe-Webhook.
 *
 * Diese Route ist der einzige Weg, auf dem eine Bestellung den Status PAID bekommt.
 *
 * Reihenfolge:
 *   1. Rohen Request-Body lesen – die Signatur gilt für exakt diese Bytes.
 *      Deshalb hier niemals request.json() verwenden.
 *   2. Signatur prüfen. Schlägt das fehl, passiert gar nichts.
 *   3. Event verarbeiten (idempotent).
 *
 * Die Route ist im Proxy von der CSP-Behandlung ausgenommen und braucht keine Cookies.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const webhookSecret = env().STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('Webhook aufgerufen, aber STRIPE_WEBHOOK_SECRET ist nicht gesetzt');
    return NextResponse.json({ error: 'Webhook nicht konfiguriert' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Signatur fehlt' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event;
  try {
    // constructEventAsync prüft Signatur UND Zeitstempel (Standardtoleranz 5 Minuten).
    // Damit sind sowohl gefälschte als auch wiedereingespielte alte Requests abgewiesen.
    event = await stripe().webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (error) {
    // Bewusst ohne Details: Ein Angreifer soll nicht erfahren, woran die Prüfung scheiterte.
    logger.warn('Stripe-Webhook mit ungültiger Signatur abgewiesen', {
      reason: error instanceof Error ? error.message : 'unbekannt',
    });
    return NextResponse.json({ error: 'Signatur ungültig' }, { status: 400 });
  }

  try {
    const result = await processStripeEvent(event);
    logger.info('Stripe-Webhook verarbeitet', { eventId: event.id, type: event.type, status: result.status });
    return NextResponse.json({ received: true });
  } catch (error) {
    const errorId = logUnexpected('stripe-webhook', error, { eventId: event.id, type: event.type });
    // 500 sorgt dafür, dass Stripe den Webhook später erneut zustellt. Die Idempotenz
    // stellt sicher, dass ein erfolgreicher zweiter Versuch nichts doppelt macht.
    return NextResponse.json({ error: 'Verarbeitung fehlgeschlagen', errorId }, { status: 500 });
  }
}
