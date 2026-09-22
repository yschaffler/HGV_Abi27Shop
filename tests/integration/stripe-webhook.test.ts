import { describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { POST } from '@/app/api/stripe/webhook/route';
import { prisma } from '@/server/db';
import { createOrderNumber, createPublicToken } from '@/server/crypto/tokens';
import { createProductWithVariant, createSettings } from './factories';

/**
 * Stripe-Webhook.
 *
 * Hier haengt das Geld dran, deshalb wird der echte Route Handler aufgerufen – inklusive
 * Signaturpruefung. Die Testsignaturen erzeugt das Stripe-SDK selbst, es wird also genau
 * der Mechanismus geprueft, der spaeter im Betrieb greift.
 */

const WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'] as string;
const stripe = new Stripe('sk_test_dummy');

async function createPendingOrderRow(totalCents = 3990) {
  await createSettings();
  const { variant } = await createProductWithVariant({ priceCents: totalCents });

  return prisma.order.create({
    data: {
      orderNumber: createOrderNumber(),
      publicToken: createPublicToken(),
      firstName: 'Max',
      lastName: 'Mustermann',
      email: 'max@example.de',
      totalCents,
      paymentStatus: 'PENDING',
      stripeCheckoutSessionId: 'cs_test_123',
      items: {
        create: {
          variantId: variant.id,
          productName: 'Abipulli',
          variantLabel: 'Schwarz · M',
          color: 'Schwarz',
          size: 'M',
          unitPriceCents: totalCents,
          quantity: 1,
          lineTotalCents: totalCents,
        },
      },
    },
  });
}

function checkoutCompletedEvent(params: {
  eventId: string;
  orderId: string;
  sessionId?: string;
  amountTotal: number;
  paymentStatus?: string;
  currency?: string;
}) {
  return {
    id: params.eventId,
    object: 'event',
    api_version: '2026-08-26.dahlia',
    created: Math.floor(Date.now() / 1000),
    type: 'checkout.session.completed',
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: params.sessionId ?? 'cs_test_123',
        object: 'checkout.session',
        amount_total: params.amountTotal,
        currency: params.currency ?? 'eur',
        payment_status: params.paymentStatus ?? 'paid',
        payment_intent: 'pi_test_123',
        client_reference_id: params.orderId,
        metadata: { orderId: params.orderId, orderNumber: 'ABI-TEST01' },
      },
    },
  };
}

function signedRequest(event: unknown, secret = WEBHOOK_SECRET): Request {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });

  return new Request('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
    body: payload,
  });
}

describe('Webhook – gueltige Signatur', () => {
  it('setzt die Bestellung auf PAID', async () => {
    const order = await createPendingOrderRow();

    const response = await POST(
      signedRequest(checkoutCompletedEvent({ eventId: 'evt_ok_1', orderId: order.id, amountTotal: 3990 })),
    );

    expect(response.status).toBe(200);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('PAID');
    expect(updated.paidAt).not.toBeNull();
    expect(updated.stripePaymentIntentId).toBe('pi_test_123');
  });

  it('protokolliert das Event, damit es nicht doppelt verarbeitet wird', async () => {
    const order = await createPendingOrderRow();

    await POST(signedRequest(checkoutCompletedEvent({ eventId: 'evt_ok_2', orderId: order.id, amountTotal: 3990 })));

    const stored = await prisma.stripeWebhookEvent.findUnique({ where: { id: 'evt_ok_2' } });
    expect(stored).not.toBeNull();
    expect(stored?.processedAt).not.toBeNull();
  });

  it('laesst die Bestellung bei einer noch nicht abgeschlossenen Zahlung unbezahlt', async () => {
    const order = await createPendingOrderRow();

    const response = await POST(
      signedRequest(
        checkoutCompletedEvent({
          eventId: 'evt_unpaid',
          orderId: order.id,
          amountTotal: 3990,
          paymentStatus: 'unpaid',
        }),
      ),
    );

    expect(response.status).toBe(200);
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('PENDING');
  });
});

describe('Webhook – ungueltige Signatur', () => {
  it('weist einen Request mit falschem Secret mit 400 ab und aendert nichts', async () => {
    const order = await createPendingOrderRow();
    const event = checkoutCompletedEvent({ eventId: 'evt_bad_1', orderId: order.id, amountTotal: 3990 });

    const response = await POST(signedRequest(event, 'whsec_falsches_secret'));

    expect(response.status).toBe(400);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('PENDING');
    expect(await prisma.stripeWebhookEvent.count()).toBe(0);
  });

  it('weist einen Request ohne Signaturkopf ab', async () => {
    const order = await createPendingOrderRow();

    const response = await POST(
      new Request('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(checkoutCompletedEvent({ eventId: 'evt_nosig', orderId: order.id, amountTotal: 3990 })),
      }),
    );

    expect(response.status).toBe(400);
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('PENDING');
  });

  it('weist einen nachtraeglich veraenderten Betrag ab, weil die Signatur nicht mehr passt', async () => {
    const order = await createPendingOrderRow();
    const event = checkoutCompletedEvent({ eventId: 'evt_tamper', orderId: order.id, amountTotal: 3990 });

    const payload = JSON.stringify(event);
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

    // Der Angreifer faengt den Request ab und setzt den Betrag auf 1 Cent.
    const tampered = payload.replace('"amount_total":3990', '"amount_total":1');

    const response = await POST(
      new Request('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': signature },
        body: tampered,
      }),
    );

    expect(response.status).toBe(400);
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('PENDING');
  });
});

describe('Webhook – Wiederholung und Replay', () => {
  it('verarbeitet dasselbe Event kein zweites Mal', async () => {
    const order = await createPendingOrderRow();
    const event = checkoutCompletedEvent({ eventId: 'evt_replay', orderId: order.id, amountTotal: 3990 });

    const first = await POST(signedRequest(event));
    expect(first.status).toBe(200);

    const paidAtAfterFirst = (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paidAt;

    const second = await POST(signedRequest(event));
    expect(second.status).toBe(200);

    const afterSecond = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(afterSecond.paymentStatus).toBe('PAID');
    // Unveraendert: der zweite Durchlauf hat nichts angefasst.
    expect(afterSecond.paidAt?.getTime()).toBe(paidAtAfterFirst?.getTime());
    expect(await prisma.stripeWebhookEvent.count()).toBe(1);
  });

  it('verarbeitet zehn gleichzeitige Zustellungen desselben Events nur einmal', async () => {
    const order = await createPendingOrderRow();
    const event = checkoutCompletedEvent({ eventId: 'evt_parallel', orderId: order.id, amountTotal: 3990 });

    const responses = await Promise.all(Array.from({ length: 10 }, () => POST(signedRequest(event))));

    // Keine Antwort darf ein Serverfehler sein.
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(await prisma.stripeWebhookEvent.count()).toBe(1);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('PAID');
  });

  it('macht aus einer bereits bezahlten Bestellung durch ein spaeteres Event nichts anderes', async () => {
    const order = await createPendingOrderRow();

    await POST(signedRequest(checkoutCompletedEvent({ eventId: 'evt_first', orderId: order.id, amountTotal: 3990 })));

    // Ein zweites, eigenstaendiges Event zur selben Bestellung.
    await POST(signedRequest(checkoutCompletedEvent({ eventId: 'evt_second', orderId: order.id, amountTotal: 3990 })));

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('PAID');
  });
});

describe('Webhook – Betragsabgleich', () => {
  it('bucht nicht, wenn der Betrag von der Bestellung abweicht', async () => {
    const order = await createPendingOrderRow(3990);

    const response = await POST(
      signedRequest(checkoutCompletedEvent({ eventId: 'evt_amount', orderId: order.id, amountTotal: 1 })),
    );

    expect(response.status).toBe(200);
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('PENDING');
  });

  it('bucht nicht bei fremder Waehrung', async () => {
    const order = await createPendingOrderRow(3990);

    await POST(
      signedRequest(
        checkoutCompletedEvent({ eventId: 'evt_currency', orderId: order.id, amountTotal: 3990, currency: 'usd' }),
      ),
    );

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('PENDING');
  });

  it('bucht nicht, wenn die Session-ID nicht zur Bestellung gehoert', async () => {
    const order = await createPendingOrderRow(3990);

    await POST(
      signedRequest(
        checkoutCompletedEvent({
          eventId: 'evt_session',
          orderId: order.id,
          amountTotal: 3990,
          sessionId: 'cs_test_fremde_session',
        }),
      ),
    );

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('PENDING');
  });
});
