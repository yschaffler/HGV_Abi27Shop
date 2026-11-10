import { describe, expect, it } from 'vitest';
import { prisma } from '@/server/db';
import { changeOrderItemVariant } from '@/server/admin/order-edit';
import { distributeItem } from '@/server/shop/distribution';
import { aggregateItems } from '@/server/export/aggregate';
import { createPaidOrder, createProductWithVariant, createUser } from './factories';

/**
 * Nachträglich eine andere Größe.
 *
 * Entscheidend ist, dass danach überall dasselbe steht: Die Position muss Varianten-ID UND
 * Snapshot (Größe, Anzeigetext) tauschen, denn Sammelbestellung, Export und Ausgabe lesen
 * genau diese Felder. Und der bezahlte Betrag darf sich nicht ändern.
 */

const ACTOR = { id: null, email: 'admin@example.de' };

async function hoodieWithSizes() {
  const { product, variant: medium } = await createProductWithVariant({ color: 'Navy', size: 'M', priceCents: 4490 });
  const large = await prisma.productVariant.create({
    data: { productId: product.id, color: 'Navy', size: 'L', label: '', priceCents: 4490 },
  });
  const xxl = await prisma.productVariant.create({
    data: { productId: product.id, color: 'Navy', size: 'XXL', label: '', priceCents: 4990 },
  });
  return { product, medium, large, xxl };
}

async function itemsOf(orderId: string) {
  return prisma.orderItem.findMany({
    where: { orderId },
    orderBy: { size: 'asc' },
    select: { variantId: true, size: true, variantLabel: true, quantity: true, lineTotalCents: true, unitPriceCents: true },
  });
}

describe('Größe einer Position ändern', () => {
  it('tauscht Variante und Snapshot, der Preis bleibt', async () => {
    const { medium, large } = await hoodieWithSizes();
    const order = await createPaidOrder({ variantId: medium.id, unitPriceCents: 4490 });
    const item = order.items[0]!;

    const result = await changeOrderItemVariant({ itemId: item.id, newVariantId: large.id, actor: ACTOR });

    expect(result.ok).toBe(true);
    expect(await itemsOf(order.id)).toEqual([
      { variantId: large.id, size: 'L', variantLabel: 'Navy · L', quantity: 1, lineTotalCents: 4490, unitPriceCents: 4490 },
    ]);
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.totalCents).toBe(order.totalCents);
  });

  it('zählt danach in der Sammelbestellung bei der neuen Größe', async () => {
    const { medium, large } = await hoodieWithSizes();
    const order = await createPaidOrder({ variantId: medium.id, unitPriceCents: 4490 });

    await changeOrderItemVariant({ itemId: order.items[0]!.id, newVariantId: large.id, actor: ACTOR });

    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    const rows = aggregateItems(items);
    expect(rows.map((row) => [row.size, row.quantity])).toEqual([['L', 1]]);
  });

  it('stellt bei Menge 2 nur ein Stück um', async () => {
    const { medium, large } = await hoodieWithSizes();
    const order = await createPaidOrder({ variantId: medium.id, unitPriceCents: 4490, quantity: 2 });

    await changeOrderItemVariant({ itemId: order.items[0]!.id, newVariantId: large.id, quantity: 1, actor: ACTOR });

    const items = await itemsOf(order.id);
    expect(items.map((item) => [item.size, item.quantity, item.lineTotalCents])).toEqual([
      ['L', 1, 4490],
      ['M', 1, 4490],
    ]);
  });

  it('führt mit einer vorhandenen Position derselben Größe zusammen', async () => {
    const { medium, large } = await hoodieWithSizes();
    const order = await createPaidOrder({ variantId: medium.id, unitPriceCents: 4490 });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        variantId: large.id,
        productName: 'Abipulli',
        variantLabel: 'Navy · L',
        color: 'Navy',
        size: 'L',
        unitPriceCents: 4490,
        quantity: 1,
        lineTotalCents: 4490,
      },
    });

    await changeOrderItemVariant({ itemId: order.items[0]!.id, newVariantId: large.id, actor: ACTOR });

    expect((await itemsOf(order.id)).map((item) => [item.size, item.quantity, item.lineTotalCents])).toEqual([
      ['L', 2, 8980],
    ]);
  });

  it('meldet einen abweichenden Katalogpreis, berechnet aber weiter den bezahlten', async () => {
    const { medium, xxl } = await hoodieWithSizes();
    const order = await createPaidOrder({ variantId: medium.id, unitPriceCents: 4490 });

    const result = await changeOrderItemVariant({ itemId: order.items[0]!.id, newVariantId: xxl.id, actor: ACTOR });

    expect(result).toMatchObject({ ok: true, priceDifferenceCents: 500 });
    expect((await itemsOf(order.id))[0]?.unitPriceCents).toBe(4490);
  });

  it('weist eine Variante eines anderen Artikels ab', async () => {
    const { medium } = await hoodieWithSizes();
    const { variant: shirt } = await createProductWithVariant({ color: 'Navy', size: 'L' });
    const order = await createPaidOrder({ variantId: medium.id, unitPriceCents: 4490 });

    const result = await changeOrderItemVariant({ itemId: order.items[0]!.id, newVariantId: shirt.id, actor: ACTOR });

    expect(result.ok).toBe(false);
    expect((await itemsOf(order.id))[0]?.variantId).toBe(medium.id);
  });

  it('sperrt eine bereits ausgegebene Position', async () => {
    const { medium, large } = await hoodieWithSizes();
    const order = await createPaidOrder({ variantId: medium.id, unitPriceCents: 4490 });
    const user = await createUser('ADMIN', `admin-${Math.random().toString(36).slice(2, 8)}@example.de`);
    await distributeItem(order.items[0]!.id, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      totpConfirmed: true,
    });

    const result = await changeOrderItemVariant({ itemId: order.items[0]!.id, newVariantId: large.id, actor: ACTOR });

    expect(result.ok).toBe(false);
    expect((await itemsOf(order.id))[0]?.size).toBe('M');
  });

  it('lehnt eine unsinnige Menge ab', async () => {
    const { medium, large } = await hoodieWithSizes();
    const order = await createPaidOrder({ variantId: medium.id, unitPriceCents: 4490 });

    const result = await changeOrderItemVariant({ itemId: order.items[0]!.id, newVariantId: large.id, quantity: 2, actor: ACTOR });

    expect(result.ok).toBe(false);
  });

  it('protokolliert die Änderung', async () => {
    const { medium, large } = await hoodieWithSizes();
    const order = await createPaidOrder({ variantId: medium.id, unitPriceCents: 4490 });

    await changeOrderItemVariant({ itemId: order.items[0]!.id, newVariantId: large.id, actor: ACTOR });

    const entry = await prisma.auditLog.findFirst({ where: { action: 'ORDER_ITEM_CHANGED', entityId: order.id } });
    expect(entry?.summary).toContain('→ Navy · L');
  });
});
