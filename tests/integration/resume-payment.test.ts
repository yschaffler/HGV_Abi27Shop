import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/server/db';
import { createOrderNumber, createPublicToken } from '@/server/crypto/tokens';
import { createProductWithVariant, createSettings } from './factories';

/**
 * Nachholen einer abgebrochenen Zahlung.
 *
 * Zwei Dinge duerfen dabei nicht passieren: Es darf keine zweite Zahlung eroeffnet werden,
 * wenn die erste Session bei Stripe schon bezahlt ist (der Webhook ist dann nur noch nicht
 * angekommen), und die alte Session muss verfallen – sonst koennte jemand mit einem alten
 * Tab eine Session bezahlen, die der Webhook anschliessend wegen der nicht mehr passenden
 * Session-ID ablehnt. Das Geld laege dann bei Stripe ohne zugehoerige Bestellung.
 *
 * Ausserdem zaehlen die Preise aus dem Snapshot der Bestellung, nicht die aktuellen
 * Katalogpreise – sonst wuerde der Betragsabgleich im Webhook scheitern.
 */

type SessionStub = { id: string; status: string; payment_status: string };

const erzeugteSessions: Array<Record<string, unknown>> = [];
const verfallen: string[] = [];
let vorhandeneSession: SessionStub = { id: 'cs_test_alt', status: 'open', payment_status: 'unpaid' };
let naechsteSessionId = 'cs_test_neu';

vi.mock('@/server/stripe/client', () => ({
  isStripeConfigured: () => true,
  stripe: () => ({
    checkout: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          erzeugteSessions.push(params);
          return { id: naechsteSessionId, url: `https://checkout.stripe.test/${naechsteSessionId}` };
        },
        retrieve: async (id: string) => {
          if (id !== vorhandeneSession.id) throw new Error('Unbekannte Session');
          return vorhandeneSession;
        },
        expire: async (id: string) => {
          verfallen.push(id);
          return { id, status: 'expired' };
        },
      },
    },
  }),
}));

const { resumeCheckoutSession } = await import('@/server/stripe/checkout');

async function createPendingOrderRow(params?: { unitPriceCents?: number; sessionId?: string | null }) {
  await createSettings();
  const unitPriceCents = params?.unitPriceCents ?? 4490;
  const { variant } = await createProductWithVariant({ priceCents: unitPriceCents });

  return prisma.order.create({
    data: {
      orderNumber: createOrderNumber(),
      publicToken: createPublicToken(),
      firstName: 'Max',
      lastName: 'Mustermann',
      email: 'max@example.de',
      totalCents: unitPriceCents,
      paymentStatus: 'PENDING',
      stripeCheckoutSessionId: params?.sessionId === undefined ? 'cs_test_alt' : params.sessionId,
      items: {
        create: {
          variantId: variant.id,
          productName: 'Abikropolis Hoodie 2027',
          variantLabel: 'Schwarz · M',
          color: 'Schwarz',
          size: 'M',
          unitPriceCents,
          quantity: 1,
          lineTotalCents: unitPriceCents,
        },
      },
    },
  });
}

beforeEach(() => {
  erzeugteSessions.length = 0;
  verfallen.length = 0;
  vorhandeneSession = { id: 'cs_test_alt', status: 'open', payment_status: 'unpaid' };
  naechsteSessionId = 'cs_test_neu';
});

describe('resumeCheckoutSession', () => {
  it('erzeugt eine neue Session und laesst die alte verfallen', async () => {
    const order = await createPendingOrderRow();

    const result = await resumeCheckoutSession(order.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toContain('cs_test_neu');
    expect(verfallen).toEqual(['cs_test_alt']);

    const aktualisiert = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(aktualisiert.stripeCheckoutSessionId).toBe('cs_test_neu');
    expect(aktualisiert.paymentAttempts).toBe(2);
    expect(aktualisiert.paymentStatus).toBe('PENDING');
  });

  it('nimmt die Preise aus dem Snapshot der Bestellung, nicht aus dem Katalog', async () => {
    const order = await createPendingOrderRow({ unitPriceCents: 4490 });

    // Der Katalogpreis steigt nach der Bestellung.
    await prisma.productVariant.updateMany({ data: { priceCents: 9900 } });

    await resumeCheckoutSession(order.id);

    const params = erzeugteSessions[0];
    expect(params).toBeDefined();
    const lineItems = params?.['line_items'] as Array<{ price_data: { unit_amount: number } }>;
    expect(lineItems[0]?.price_data.unit_amount).toBe(4490);
  });

  it('eroeffnet keine zweite Zahlung, wenn die alte Session bereits bezahlt ist', async () => {
    const order = await createPendingOrderRow();
    vorhandeneSession = { id: 'cs_test_alt', status: 'complete', payment_status: 'paid' };

    const result = await resumeCheckoutSession(order.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('ALREADY_PAID');
    expect(erzeugteSessions).toHaveLength(0);
    expect(verfallen).toHaveLength(0);
  });

  it('lehnt eine bereits bezahlte Bestellung ab', async () => {
    const order = await createPendingOrderRow();
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'PAID', paidAt: new Date() },
    });

    const result = await resumeCheckoutSession(order.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('ALREADY_PAID');
    expect(erzeugteSessions).toHaveLength(0);
  });

  it('kommt ohne vorherige Session aus', async () => {
    const order = await createPendingOrderRow({ sessionId: null });

    const result = await resumeCheckoutSession(order.id);

    expect(result.ok).toBe(true);
    expect(verfallen).toHaveLength(0);
    expect(erzeugteSessions).toHaveLength(1);
  });

  it('verwendet je Versuch einen eigenen Idempotenzschluessel', async () => {
    const order = await createPendingOrderRow();

    await resumeCheckoutSession(order.id);

    // Zweiter Anlauf: Die inzwischen hinterlegte Session ist wieder offen.
    vorhandeneSession = { id: 'cs_test_neu', status: 'open', payment_status: 'unpaid' };
    naechsteSessionId = 'cs_test_neu2';
    await resumeCheckoutSession(order.id);

    const aktualisiert = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(aktualisiert.paymentAttempts).toBe(3);
    expect(aktualisiert.stripeCheckoutSessionId).toBe('cs_test_neu2');
  });
});
