import { describe, expect, it } from 'vitest';
import { prisma } from '@/server/db';
import { createPendingOrder } from '@/server/shop/order';
import { createProductWithVariant, createSettings } from './factories';

/**
 * Bestellanlage gegen eine echte Datenbank.
 *
 * Geprueft wird das, was nur hier sichtbar wird: dass der Preis-Snapshot tatsaechlich
 * geschrieben wird, dass eine Bestellung immer als PENDING entsteht, und dass ausserhalb
 * des Bestellzeitraums serverseitig nichts angelegt wird.
 */

const CUSTOMER = {
  firstName: 'Max',
  lastName: 'Mustermann',
  email: 'max@example.de',
  acceptedTerms: true as const,
  acceptedPickup: true as const,
};

describe('createPendingOrder – gueltige Bestellung', () => {
  it('legt Bestellung und Positionen mit serverseitig berechnetem Preis an', async () => {
    await createSettings();
    const { variant } = await createProductWithVariant({ priceCents: 3990 });

    const result = await createPendingOrder({
      ...CUSTOMER,
      items: [{ variantId: variant.id, quantity: 2 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: result.orderId },
      include: { items: true },
    });

    expect(order.totalCents).toBe(7980);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]?.unitPriceCents).toBe(3990);
    expect(order.items[0]?.lineTotalCents).toBe(7980);
    expect(order.items[0]?.quantity).toBe(2);
  });

  it('erzeugt die Bestellung immer als PENDING – niemals direkt als bezahlt', async () => {
    await createSettings();
    const { variant } = await createProductWithVariant();

    const result = await createPendingOrder({ ...CUSTOMER, items: [{ variantId: variant.id, quantity: 1 }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId } });
    expect(order.paymentStatus).toBe('PENDING');
    expect(order.paidAt).toBeNull();
  });

  it('vergibt eine Bestellnummer und ein davon unabhaengiges Zugriffstoken', async () => {
    await createSettings();
    const { variant } = await createProductWithVariant();

    const result = await createPendingOrder({ ...CUSTOMER, items: [{ variantId: variant.id, quantity: 1 }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.orderNumber).toMatch(/^ABI-[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(result.publicToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.publicToken).not.toContain(result.orderNumber);
  });

  it('haelt den Preis fest, auch wenn die Variante spaeter teurer wird', async () => {
    await createSettings();
    const { variant } = await createProductWithVariant({ priceCents: 3990 });

    const result = await createPendingOrder({ ...CUSTOMER, items: [{ variantId: variant.id, quantity: 1 }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await prisma.productVariant.update({ where: { id: variant.id }, data: { priceCents: 9990 } });

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: result.orderId },
      include: { items: true },
    });

    expect(order.totalCents).toBe(3990);
    expect(order.items[0]?.unitPriceCents).toBe(3990);
  });

  it('vergibt bei mehreren Bestellungen unterschiedliche Nummern und Tokens', async () => {
    await createSettings();
    const { variant } = await createProductWithVariant();

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        createPendingOrder({ ...CUSTOMER, items: [{ variantId: variant.id, quantity: 1 }] }),
      ),
    );

    const numbers = new Set(results.filter((r) => r.ok).map((r) => (r.ok ? r.orderNumber : '')));
    const tokens = new Set(results.filter((r) => r.ok).map((r) => (r.ok ? r.publicToken : '')));

    expect(numbers.size).toBe(10);
    expect(tokens.size).toBe(10);
  });
});

describe('createPendingOrder – ungueltige Varianten', () => {
  it('lehnt eine unbekannte Variante ab und legt nichts an', async () => {
    await createSettings();

    const result = await createPendingOrder({ ...CUSTOMER, items: [{ variantId: 'gibt-es-nicht', quantity: 1 }] });

    expect(result.ok).toBe(false);
    expect(await prisma.order.count()).toBe(0);
  });

  it('lehnt eine deaktivierte Variante ab', async () => {
    await createSettings();
    const { variant } = await createProductWithVariant({ variantActive: false });

    const result = await createPendingOrder({ ...CUSTOMER, items: [{ variantId: variant.id, quantity: 1 }] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('PRICING');
    expect(await prisma.order.count()).toBe(0);
  });

  it('lehnt die Variante eines deaktivierten Produkts ab', async () => {
    await createSettings();
    const { variant } = await createProductWithVariant({ productActive: false });

    const result = await createPendingOrder({ ...CUSTOMER, items: [{ variantId: variant.id, quantity: 1 }] });

    expect(result.ok).toBe(false);
    expect(await prisma.order.count()).toBe(0);
  });
});

describe('createPendingOrder – Bestellschluss', () => {
  it('lehnt Bestellungen vor dem Start ab', async () => {
    await createSettings({
      orderStartAt: new Date(Date.now() + 60 * 60 * 1000),
      orderEndAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });
    const { variant } = await createProductWithVariant();

    const result = await createPendingOrder({ ...CUSTOMER, items: [{ variantId: variant.id, quantity: 1 }] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('WINDOW_CLOSED');
    expect(await prisma.order.count()).toBe(0);
  });

  it('lehnt Bestellungen nach dem Bestellschluss ab', async () => {
    await createSettings({
      orderStartAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      orderEndAt: new Date(Date.now() - 1000),
    });
    const { variant } = await createProductWithVariant();

    const result = await createPendingOrder({ ...CUSTOMER, items: [{ variantId: variant.id, quantity: 1 }] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('WINDOW_CLOSED');
    expect(await prisma.order.count()).toBe(0);
  });

  it('erlaubt Bestellungen innerhalb des Zeitraums', async () => {
    await createSettings({
      orderStartAt: new Date(Date.now() - 60 * 60 * 1000),
      orderEndAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const { variant } = await createProductWithVariant();

    const result = await createPendingOrder({ ...CUSTOMER, items: [{ variantId: variant.id, quantity: 1 }] });

    expect(result.ok).toBe(true);
  });
});
