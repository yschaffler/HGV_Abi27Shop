import { describe, expect, it } from 'vitest';
import { prisma } from '@/server/db';
import {
  distributeAllItems,
  distributeItem,
  searchPaidOrders,
} from '@/server/shop/distribution';
import { createPaidOrder, createProductWithVariant, createUser } from './factories';
import type { AuthUser } from '@/server/auth/session';

/**
 * Warenausgabe.
 *
 * Der wichtigste Test ist der auf gleichzeitige Ausgabe: An der Ausgabe stehen mehrere
 * Leute mit mehreren iPads, und ein Pulli darf nicht zweimal rausgehen.
 */

async function actor(): Promise<AuthUser> {
  const user = await createUser('DISTRIBUTION', `ausgabe-${Math.random().toString(36).slice(2, 8)}@example.de`);
  return { id: user.id, email: user.email, name: user.name, role: user.role, totpConfirmed: true };
}

describe('Einzelne Position ausgeben', () => {
  it('markiert die Position und haelt Zeitpunkt und Person fest', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id });
    const user = await actor();
    const item = order.items[0];
    if (!item) throw new Error('keine Position');

    const result = await distributeItem(item.id, user);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(1);
    expect(result.alreadyDistributed).toBe(false);

    const updated = await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.distributionStatus).toBe('DISTRIBUTED');
    expect(updated.distributedAt).not.toBeNull();
    expect(updated.distributedByUserId).toBe(user.id);
  });

  it('schreibt einen Eintrag ins Protokoll', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id });
    const item = order.items[0];
    if (!item) throw new Error('keine Position');

    await distributeItem(item.id, await actor());

    const entries = await prisma.auditLog.findMany({ where: { action: 'ITEM_DISTRIBUTED' } });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.summary).toContain(order.orderNumber);
  });

  it('gibt eine bereits ausgegebene Position nicht erneut aus', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id });
    const user = await actor();
    const item = order.items[0];
    if (!item) throw new Error('keine Position');

    await distributeItem(item.id, user);
    const second = await distributeItem(item.id, user);

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.changed).toBe(0);
    expect(second.alreadyDistributed).toBe(true);

    // Kein zweiter Protokolleintrag – es ist ja nichts passiert.
    expect(await prisma.auditLog.count({ where: { action: 'ITEM_DISTRIBUTED' } })).toBe(1);
  });

  it('gibt nichts aus, solange die Bestellung nicht bezahlt ist', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id });
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PENDING' } });

    const item = order.items[0];
    if (!item) throw new Error('keine Position');

    const result = await distributeItem(item.id, await actor());

    expect(result.ok).toBe(false);
    const unchanged = await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(unchanged.distributionStatus).toBe('NOT_DISTRIBUTED');
  });
});

describe('Teilweise und vollstaendige Ausgabe', () => {
  it('setzt den Bestellstatus bei einer von drei Positionen auf teilweise', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id, itemCount: 3 });
    const item = order.items[0];
    if (!item) throw new Error('keine Position');

    await distributeItem(item.id, await actor());

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.distributionStatus).toBe('PARTIALLY_DISTRIBUTED');
    expect(updated.distributionCompletedAt).toBeNull();
  });

  it('setzt den Bestellstatus erst bei der letzten Position auf vollstaendig', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id, itemCount: 3 });
    const user = await actor();

    for (const [index, item] of order.items.entries()) {
      await distributeItem(item.id, user);

      const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      const expected =
        index === order.items.length - 1 ? 'FULLY_DISTRIBUTED' : 'PARTIALLY_DISTRIBUTED';

      expect(updated.distributionStatus).toBe(expected);
    }

    const finished = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(finished.distributionCompletedAt).not.toBeNull();
  });
});

describe('Alles ausgeben', () => {
  it('gibt alle offenen Positionen auf einmal aus', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id, itemCount: 3 });

    const result = await distributeAllItems(order.id, await actor());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(3);
    expect(result.orderStatus).toBe('FULLY_DISTRIBUTED');
  });

  it('laesst bereits ausgegebene Positionen unangetastet', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id, itemCount: 3 });
    const user = await actor();
    const first = order.items[0];
    if (!first) throw new Error('keine Position');

    await distributeItem(first.id, user);
    const before = await prisma.orderItem.findUniqueOrThrow({ where: { id: first.id } });

    const result = await distributeAllItems(order.id, user);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Nur die beiden noch offenen Positionen wurden geaendert.
    expect(result.changed).toBe(2);

    const after = await prisma.orderItem.findUniqueOrThrow({ where: { id: first.id } });
    expect(after.distributedAt?.getTime()).toBe(before.distributedAt?.getTime());
  });

  it('meldet, wenn ohnehin schon alles ausgegeben war', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id, itemCount: 2 });
    const user = await actor();

    await distributeAllItems(order.id, user);
    const second = await distributeAllItems(order.id, user);

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.changed).toBe(0);
    expect(second.alreadyDistributed).toBe(true);
  });
});

describe('Gleichzeitige Ausgabe an mehreren Geraeten', () => {
  it('gibt dieselbe Position auch bei acht gleichzeitigen Klicks nur einmal aus', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id });
    const user = await actor();
    const item = order.items[0];
    if (!item) throw new Error('keine Position');

    const results = await Promise.all(Array.from({ length: 8 }, () => distributeItem(item.id, user)));

    const changed = results.filter((result) => result.ok && result.changed === 1);
    expect(changed).toHaveLength(1);

    // Und genau ein Protokolleintrag, nicht acht.
    expect(await prisma.auditLog.count({ where: { action: 'ITEM_DISTRIBUTED' } })).toBe(1);
  });

  it('zaehlt bei gleichzeitigem "Alles ausgeben" jede Position nur einmal', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id, itemCount: 4 });
    const user = await actor();

    const results = await Promise.all(Array.from({ length: 5 }, () => distributeAllItems(order.id, user)));

    const totalChanged = results.reduce(
      (sum, result) => sum + (result.ok ? result.changed : 0),
      0,
    );

    expect(totalChanged).toBe(4);

    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    expect(items.every((item) => item.distributionStatus === 'DISTRIBUTED')).toBe(true);
  });

  it('bleibt konsistent, wenn Einzelausgabe und Sammelausgabe gleichzeitig laufen', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id, itemCount: 3 });
    const user = await actor();
    const first = order.items[0];
    if (!first) throw new Error('keine Position');

    const [single, all] = await Promise.all([
      distributeItem(first.id, user),
      distributeAllItems(order.id, user),
    ]);

    const changed =
      (single.ok ? single.changed : 0) + (all.ok ? all.changed : 0);

    // Insgesamt genau drei Positionen, egal wie sich die beiden Aufrufe aufteilen.
    expect(changed).toBe(3);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.distributionStatus).toBe('FULLY_DISTRIBUTED');
  });
});

describe('Suche an der Ausgabe', () => {
  it('findet ueber Vor- und Nachnamen gemeinsam', async () => {
    const { variant } = await createProductWithVariant();
    await createPaidOrder({ variantId: variant.id, firstName: 'Max', lastName: 'Mustermann' });
    await createPaidOrder({ variantId: variant.id, firstName: 'Maximilian', lastName: 'Mustermann' });
    await createPaidOrder({ variantId: variant.id, firstName: 'Erika', lastName: 'Musterfrau' });

    const hits = await searchPaidOrders('Max Mus');

    expect(hits).toHaveLength(2);
    expect(hits.every((hit) => hit.lastName === 'Mustermann')).toBe(true);
  });

  it('findet ueber die Bestellnummer', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id });

    const hits = await searchPaidOrders(order.orderNumber);

    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe(order.id);
  });

  it('findet unbezahlte Bestellungen nicht', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id, lastName: 'Unbezahlt' });
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PENDING' } });

    expect(await searchPaidOrders('Unbezahlt')).toHaveLength(0);
  });

  it('liefert bei zu kurzer Eingabe nichts', async () => {
    const { variant } = await createProductWithVariant();
    await createPaidOrder({ variantId: variant.id });

    expect(await searchPaidOrders('M')).toHaveLength(0);
  });

  it('gibt mit einem Prozentzeichen nicht die gesamte Liste heraus', async () => {
    const { variant } = await createProductWithVariant();
    await createPaidOrder({ variantId: variant.id, lastName: 'Mustermann' });

    // "%" ist in LIKE ein Platzhalter und wird deshalb vorher entfernt.
    expect(await searchPaidOrders('%%')).toHaveLength(0);
  });

  it('meldet den Ausgabefortschritt je Treffer', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id, itemCount: 3, lastName: 'Fortschritt' });
    const item = order.items[0];
    if (!item) throw new Error('keine Position');

    await distributeItem(item.id, await actor());

    const hits = await searchPaidOrders('Fortschritt');
    expect(hits[0]?.itemCount).toBe(3);
    expect(hits[0]?.distributedCount).toBe(1);
  });
});
