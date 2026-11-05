import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/server/db';
import { createOrderNumber, createPublicToken } from '@/server/crypto/tokens';
import { createProductWithVariant, createSettings } from './factories';

/**
 * Nachholen, wenn der Stripe-Webhook ausbleibt.
 *
 * Der Abgleich fragt Stripe direkt. Er darf nur buchen, was Stripe als bezahlt meldet und
 * was betragsmaessig zur Bestellung passt – genau wie der Webhook. Und die Bestaetigungsmail
 * muss sich jederzeit von Hand nachschicken lassen, aber nur fuer bezahlte Bestellungen.
 */

type SessionStub = {
  id: string;
  status: string;
  payment_status: string;
  amount_total: number;
  currency: string;
  payment_intent: string;
  metadata: Record<string, string>;
  client_reference_id: string | null;
};

const sessions = new Map<string, SessionStub>();
let stripeDown = false;

vi.mock('@/server/stripe/client', () => ({
  isStripeConfigured: () => true,
  stripe: () => ({
    checkout: {
      sessions: {
        retrieve: async (id: string) => {
          if (stripeDown) throw new Error('Stripe nicht erreichbar');
          const session = sessions.get(id);
          if (!session) throw new Error('Unbekannte Session');
          return session;
        },
      },
    },
  }),
}));

const { reconcileOpenOrders, reconcileOrderPayment } = await import('@/server/stripe/reconcile');
const { sendMissingConfirmations, sendOrderConfirmation } = await import('@/server/mail/order-confirmation');

async function createOrder(params: {
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED';
  email?: string;
  totalCents?: number;
} = {}) {
  await createSettings();
  const totalCents = params.totalCents ?? 4490;
  const { variant } = await createProductWithVariant({ priceCents: totalCents });
  const sessionId = `cs_test_${Math.random().toString(36).slice(2, 10)}`;

  const order = await prisma.order.create({
    data: {
      orderNumber: createOrderNumber(),
      publicToken: createPublicToken(),
      firstName: 'Max',
      lastName: 'Mustermann',
      email: params.email ?? 'max@example.de',
      totalCents,
      paymentStatus: params.paymentStatus ?? 'PENDING',
      paidAt: params.paymentStatus === 'PAID' ? new Date() : null,
      stripeCheckoutSessionId: sessionId,
      items: {
        create: {
          variantId: variant.id,
          productName: 'Abikropolis Hoodie 2027',
          variantLabel: 'Navy · M',
          color: 'Navy',
          size: 'M',
          unitPriceCents: totalCents,
          quantity: 1,
          lineTotalCents: totalCents,
        },
      },
    },
  });

  return { order, sessionId };
}

function stripeSession(orderId: string, sessionId: string, overrides: Partial<SessionStub> = {}): SessionStub {
  const session: SessionStub = {
    id: sessionId,
    status: 'complete',
    payment_status: 'paid',
    amount_total: 4490,
    currency: 'eur',
    payment_intent: `pi_${sessionId}`,
    metadata: { orderId },
    client_reference_id: orderId,
    ...overrides,
  };
  sessions.set(sessionId, session);
  return session;
}

beforeEach(() => {
  sessions.clear();
  stripeDown = false;
});

describe('Abgleich einer Bestellung mit Stripe', () => {
  it('bucht eine bei Stripe bezahlte Bestellung nach und verschickt die Mail', async () => {
    const { order, sessionId } = await createOrder();
    stripeSession(order.id, sessionId);

    const result = await reconcileOrderPayment(order.id);

    expect(result).toMatchObject({ status: 'paid_now', mailSent: true });
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('PAID');
    expect(updated.stripePaymentIntentId).toBe(`pi_${sessionId}`);
    expect(updated.confirmationEmailSentAt).not.toBeNull();
  });

  it('laesst eine bei Stripe unbezahlte Bestellung offen', async () => {
    const { order, sessionId } = await createOrder();
    stripeSession(order.id, sessionId, { status: 'open', payment_status: 'unpaid' });

    const result = await reconcileOrderPayment(order.id);

    expect(result.status).toBe('not_paid');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('PENDING');
  });

  it('bucht nicht, wenn der Betrag bei Stripe abweicht', async () => {
    const { order, sessionId } = await createOrder();
    stripeSession(order.id, sessionId, { amount_total: 100 });

    const result = await reconcileOrderPayment(order.id);

    expect(result.status).toBe('mismatch');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('PENDING');
  });

  it('meldet einen Stripe-Ausfall, statt etwas zu buchen', async () => {
    const { order, sessionId } = await createOrder();
    stripeSession(order.id, sessionId);
    stripeDown = true;

    expect((await reconcileOrderPayment(order.id)).status).toBe('stripe_error');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('PENDING');
  });

  it('fasst eine bereits bezahlte Bestellung nicht an', async () => {
    const { order } = await createOrder({ paymentStatus: 'PAID' });
    expect((await reconcileOrderPayment(order.id)).status).toBe('already_paid');
  });

  it('gleicht alle offenen Bestellungen in einem Rutsch ab', async () => {
    const paid = await createOrder();
    const unpaid = await createOrder();
    const failed = await createOrder({ paymentStatus: 'FAILED' });
    stripeSession(paid.order.id, paid.sessionId);
    stripeSession(unpaid.order.id, unpaid.sessionId, { status: 'open', payment_status: 'unpaid' });
    stripeSession(failed.order.id, failed.sessionId);

    const summary = await reconcileOpenOrders();

    expect(summary).toEqual({ checked: 3, paidNow: 2, errors: 0 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: failed.order.id } })).paymentStatus).toBe('PAID');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: unpaid.order.id } })).paymentStatus).toBe('PENDING');
  });
});

describe('Bestaetigungsmail von Hand', () => {
  it('geht nicht an eine unbezahlte Bestellung', async () => {
    const { order } = await createOrder();
    expect(await sendOrderConfirmation(order.id)).toBe('not_paid');
  });

  it('geht automatisch nur einmal, auf ausdruecklichen Wunsch aber erneut', async () => {
    const { order } = await createOrder({ paymentStatus: 'PAID' });

    expect(await sendOrderConfirmation(order.id)).toBe('sent');
    expect(await sendOrderConfirmation(order.id)).toBe('already_sent');
    expect(await sendOrderConfirmation(order.id, { resend: true })).toBe('sent');
  });

  it('erreicht auch die sechste Bestellung derselben Adresse', async () => {
    // Frueher galt das Limit je Adresse – wer fuer Geschwister mitbestellte, bekam ab der
    // sechsten Bestellung stillschweigend keine Bestaetigung mehr.
    const email = `familie-${Math.random().toString(36).slice(2, 8)}@example.de`;
    const orders = [];
    for (let index = 0; index < 6; index += 1) {
      orders.push((await createOrder({ paymentStatus: 'PAID', email })).order);
    }

    for (const order of orders) {
      expect(await sendOrderConfirmation(order.id)).toBe('sent');
    }
  });

  it('schickt allen bezahlten Bestellungen ohne Bestaetigung die Mail nach', async () => {
    const first = await createOrder({ paymentStatus: 'PAID' });
    const second = await createOrder({ paymentStatus: 'PAID' });
    await createOrder();
    await sendOrderConfirmation(first.order.id);

    const summary = await sendMissingConfirmations();

    expect(summary).toEqual({ pending: 1, sent: 1, failed: 0 });
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: second.order.id } });
    expect(updated.confirmationEmailSentAt).not.toBeNull();
  });
});
