import { describe, expect, it } from 'vitest';
import { prisma } from '@/server/db';
import {
  distributeAllItems,
  distributeItem,
  revokeAllDistributions,
  revokeItemDistribution,
} from '@/server/shop/distribution';
import { createPaidOrder, createProductWithVariant, createUser } from './factories';
import type { AuthUser } from '@/server/auth/session';

/**
 * Korrektur der Warenausgabe.
 *
 * An der Ausgabe wird mal daneben getippt. Wichtig ist dabei zweierlei: Der Zeitstempel und
 * die ausgebende Person muessen mit verschwinden – sonst steht spaeter im Protokoll, jemand
 * habe etwas ausgegeben, das nie rausging. Und der denormalisierte Gesamtstatus der
 * Bestellung muss mit zurueckfallen.
 */

async function actor(): Promise<AuthUser> {
  const user = await createUser('ADMIN', `admin-${Math.random().toString(36).slice(2, 8)}@example.de`);
  return { id: user.id, email: user.email, name: user.name, role: user.role, totpConfirmed: true };
}

describe('Ausgabe einer Position zuruecknehmen', () => {
  it('setzt Status, Zeitpunkt und Person zurueck', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id });
    const user = await actor();
    const item = order.items[0];
    if (!item) throw new Error('keine Position');

    await distributeItem(item.id, user);

    const result = await revokeItemDistribution(item.id, user);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(1);

    const updated = await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.distributionStatus).toBe('NOT_DISTRIBUTED');
    expect(updated.distributedAt).toBeNull();
    expect(updated.distributedByUserId).toBeNull();
  });

  it('setzt den Gesamtstatus der Bestellung mit zurueck', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id, itemCount: 2 });
    const user = await actor();

    await distributeAllItems(order.id, user);

    const nachAusgabe = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(nachAusgabe.distributionStatus).toBe('FULLY_DISTRIBUTED');
    expect(nachAusgabe.distributionCompletedAt).not.toBeNull();

    const ersteposition = order.items[0];
    if (!ersteposition) throw new Error('keine Position');
    await revokeItemDistribution(ersteposition.id, user);

    const nachRuecknahme = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(nachRuecknahme.distributionStatus).toBe('PARTIALLY_DISTRIBUTED');
    expect(nachRuecknahme.distributionCompletedAt).toBeNull();
  });

  it('meldet eine zweite Ruecknahme als wirkungslos, statt Unsinn zu schreiben', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id });
    const user = await actor();
    const item = order.items[0];
    if (!item) throw new Error('keine Position');

    await distributeItem(item.id, user);
    await revokeItemDistribution(item.id, user);

    const zweite = await revokeItemDistribution(item.id, user);

    expect(zweite.ok).toBe(true);
    if (!zweite.ok) return;
    expect(zweite.changed).toBe(0);
    expect(zweite.alreadyDistributed).toBe(true);
  });

  it('protokolliert die Ruecknahme', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id });
    const user = await actor();
    const item = order.items[0];
    if (!item) throw new Error('keine Position');

    await distributeItem(item.id, user);
    await revokeItemDistribution(item.id, user);

    const eintrag = await prisma.auditLog.findFirst({
      where: { action: 'ITEM_DISTRIBUTION_REVOKED', entityId: item.id },
    });

    expect(eintrag).not.toBeNull();
    expect(eintrag?.actorEmail).toBe(user.email);
  });
});

describe('Gesamte Ausgabe zuruecknehmen', () => {
  it('setzt alle Positionen zurueck', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id, itemCount: 3 });
    const user = await actor();

    await distributeAllItems(order.id, user);
    const result = await revokeAllDistributions(order.id, user);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(3);
    expect(result.orderStatus).toBe('NOT_DISTRIBUTED');

    const offen = await prisma.orderItem.count({
      where: { orderId: order.id, distributionStatus: 'NOT_DISTRIBUTED' },
    });
    expect(offen).toBe(3);
  });

  it('laesst sich danach erneut ausgeben', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id, itemCount: 2 });
    const user = await actor();

    await distributeAllItems(order.id, user);
    await revokeAllDistributions(order.id, user);
    const erneut = await distributeAllItems(order.id, user);

    expect(erneut.ok).toBe(true);
    if (!erneut.ok) return;
    expect(erneut.changed).toBe(2);
    expect(erneut.orderStatus).toBe('FULLY_DISTRIBUTED');
  });
});
