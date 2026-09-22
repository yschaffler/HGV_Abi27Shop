import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/server/db';
import { createPaidOrder, createProductWithVariant } from './factories';

/**
 * Rundmail an die Besteller.
 *
 * Geprueft wird das, was bei 160 Empfaengern wirklich weh tut: dass niemand die Mail
 * doppelt bekommt, dass ein zweiter Anlauf nur die Fehlenden anschreibt, und dass der
 * Freitext des Admins nicht als Markup in der Mail landet.
 */

const versendet: Array<{ to: string; subject: string; text: string; html: string }> = [];
let naechsterVersuchScheitert: Set<string> = new Set();

vi.mock('@/server/mail/mailer', () => ({
  sendMail: async (message: { to: string; subject: string; text: string; html: string }) => {
    if (naechsterVersuchScheitert.has(message.to)) {
      return { ok: false as const, error: 'Postfach nicht erreichbar' };
    }
    versendet.push(message);
    return { ok: true as const };
  },
}));

const { countRecipients, runBroadcast } = await import('@/server/mail/broadcast');

async function createBroadcast(body = 'Abholung am Freitag in der Pausenhalle.') {
  return prisma.broadcast.create({
    data: {
      subject: 'Abholung eurer Abi-Hoodies',
      body,
      audience: 'PAID',
      recipientCount: await countRecipients('PAID'),
    },
    select: { id: true },
  });
}

beforeEach(() => {
  versendet.length = 0;
  naechsterVersuchScheitert = new Set();
});

describe('Empfaengerkreis', () => {
  it('zaehlt nur bezahlte Bestellungen', async () => {
    const { variant } = await createProductWithVariant();
    await createPaidOrder({ variantId: variant.id });

    await prisma.order.create({
      data: {
        orderNumber: 'ABI-OFFEN1',
        publicToken: 'token-offen-1234567890123456789012',
        firstName: 'Lea',
        lastName: 'Unbezahlt',
        email: 'lea@example.de',
        totalCents: 4490,
        paymentStatus: 'PENDING',
      },
    });

    expect(await countRecipients('PAID')).toBe(1);
  });

  it('laesst bei "noch nicht abgeholt" die vollstaendig ausgegebenen weg', async () => {
    const { variant } = await createProductWithVariant();
    const offen = await createPaidOrder({ variantId: variant.id });
    const fertig = await createPaidOrder({ variantId: variant.id });

    await prisma.order.update({
      where: { id: fertig.id },
      data: { distributionStatus: 'FULLY_DISTRIBUTED' },
    });

    expect(await countRecipients('PAID')).toBe(2);
    expect(await countRecipients('PAID_NOT_DISTRIBUTED')).toBe(1);

    const broadcast = await prisma.broadcast.create({
      data: { subject: 'Test', body: 'Text', audience: 'PAID_NOT_DISTRIBUTED', recipientCount: 1 },
      select: { id: true },
    });

    await runBroadcast(broadcast.id);

    expect(versendet).toHaveLength(1);
    const empfaenger = await prisma.broadcastDelivery.findMany({ where: { broadcastId: broadcast.id } });
    expect(empfaenger.map((row) => row.orderId)).toEqual([offen.id]);
  });
});

describe('Versand', () => {
  it('schreibt jeden Empfaenger genau einmal an', async () => {
    const { variant } = await createProductWithVariant();
    await createPaidOrder({ variantId: variant.id, lastName: 'Aaa' });
    await createPaidOrder({ variantId: variant.id, lastName: 'Bbb' });

    const broadcast = await createBroadcast();
    await runBroadcast(broadcast.id);

    expect(versendet).toHaveLength(2);

    const nachher = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } });
    expect(nachher.status).toBe('SENT');
    expect(nachher.sentCount).toBe(2);
    expect(nachher.failedCount).toBe(0);
  });

  it('verschickt bei einem zweiten Aufruf nichts erneut', async () => {
    const { variant } = await createProductWithVariant();
    await createPaidOrder({ variantId: variant.id });

    const broadcast = await createBroadcast();
    await runBroadcast(broadcast.id);
    versendet.length = 0;

    await runBroadcast(broadcast.id);

    expect(versendet).toHaveLength(0);
  });

  it('schreibt beim zweiten Anlauf nur die an, bei denen der Versand scheiterte', async () => {
    const { variant } = await createProductWithVariant();
    const gut = await createPaidOrder({ variantId: variant.id, lastName: 'Klappt' });
    const schlecht = await prisma.order.create({
      data: {
        orderNumber: 'ABI-FEHL01',
        publicToken: 'token-fehler-123456789012345678901',
        firstName: 'Nina',
        lastName: 'Zzz',
        email: 'kaputt@example.de',
        totalCents: 4490,
        paymentStatus: 'PAID',
        paidAt: new Date(),
      },
    });

    naechsterVersuchScheitert.add('kaputt@example.de');

    const broadcast = await createBroadcast();
    await runBroadcast(broadcast.id);

    expect(versendet.map((mail) => mail.to)).toEqual([gut.email]);

    const nachErstem = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } });
    expect(nachErstem.status).toBe('FAILED');
    expect(nachErstem.failedCount).toBe(1);

    // Zweiter Anlauf, diesmal klappt die Zustellung.
    naechsterVersuchScheitert.clear();
    versendet.length = 0;
    await runBroadcast(broadcast.id);

    expect(versendet.map((mail) => mail.to)).toEqual([schlecht.email]);

    const nachZweitem = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } });
    expect(nachZweitem.status).toBe('SENT');
    expect(nachZweitem.sentCount).toBe(2);
    expect(nachZweitem.failedCount).toBe(0);
  });
});

describe('Inhalt', () => {
  it('ergaenzt Anrede, Bestellnummer und persoenlichen Link', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id, firstName: 'Jonas' });

    const broadcast = await createBroadcast('Abholung am Freitag, 12:30 Uhr, Pausenhalle.');
    await runBroadcast(broadcast.id);

    const mail = versendet[0];
    expect(mail).toBeDefined();
    if (!mail) return;

    expect(mail.to).toBe(order.email);
    expect(mail.text).toContain('Hallo Jonas,');
    expect(mail.text).toContain('Abholung am Freitag, 12:30 Uhr, Pausenhalle.');
    expect(mail.text).toContain(order.orderNumber);
    expect(mail.text).toContain(order.publicToken);
  });

  it('gibt HTML aus dem Freitext als Text aus, statt es auszuwerten', async () => {
    const { variant } = await createProductWithVariant();
    await createPaidOrder({ variantId: variant.id });

    const broadcast = await createBroadcast('Achtung <script>alert(1)</script> und <b>fett</b>.');
    await runBroadcast(broadcast.id);

    const mail = versendet[0];
    expect(mail).toBeDefined();
    if (!mail) return;

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).not.toContain('<b>fett</b>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('behaelt Absaetze und Zeilenumbrueche des Freitexts bei', async () => {
    const { variant } = await createProductWithVariant();
    await createPaidOrder({ variantId: variant.id });

    const broadcast = await createBroadcast('Wann: Freitag\nWo: Pausenhalle\n\nBringt die Nummer mit.');
    await runBroadcast(broadcast.id);

    const mail = versendet[0];
    expect(mail).toBeDefined();
    if (!mail) return;

    expect(mail.html).toContain('Wann: Freitag<br>Wo: Pausenhalle');
    expect(mail.html).toContain('<p style="margin:0 0 12px">Bringt die Nummer mit.</p>');
  });
});
