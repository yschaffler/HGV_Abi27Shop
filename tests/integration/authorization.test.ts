import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Berechtigungen.
 *
 * Geprueft wird die Schicht, auf der im Betrieb wirklich alles haengt: Sessions und Rollen.
 * `next/headers` wird durch einen kleinen Cookie-Speicher ersetzt, damit dieselben Funktionen
 * laufen koennen wie in der Anwendung – nur eben ohne echten HTTP-Request drumherum.
 */

type CookieEntry = { name: string; value: string };

const cookieJar = new Map<string, CookieEntry>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string) => {
      cookieJar.set(name, { name, value });
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
  headers: async () => new Headers(),
}));

const { prisma } = await import('@/server/db');
const { createSession, getSessionContext, SESSION_COOKIE } = await import('@/server/auth/session');
const { authorize, getAuthenticatedUser, requiresTotp } = await import('@/server/auth/rbac');
const { findOrderByPublicToken } = await import('@/server/shop/order');
const { createUser, createPaidOrder, createProductWithVariant } = await import('./factories');
const { GET: exportRoute } = await import('@/app/api/admin/export/route');
const { GET: searchRoute } = await import('@/app/api/distribution/search/route');

beforeEach(() => cookieJar.clear());

describe('Ohne Anmeldung', () => {
  it('liefert keinen Benutzer', async () => {
    expect(await getAuthenticatedUser()).toBeNull();
  });

  it('verweigert jede Admin-Aktion', async () => {
    const result = await authorize(['ADMIN']);
    expect(result.ok).toBe(false);
  });

  it('verweigert auch die Ausgabe-Aktionen', async () => {
    const result = await authorize(['ADMIN', 'DISTRIBUTION']);
    expect(result.ok).toBe(false);
  });

  it('gibt den Export nicht heraus und verraet die Route nicht', async () => {
    const response = await exportRoute(
      new Request('http://localhost:3000/api/admin/export?kind=aggregate&format=csv'),
    );
    expect(response.status).toBe(404);
  });

  it('gibt die Ausgabesuche nicht heraus', async () => {
    const response = await searchRoute(new Request('http://localhost:3000/api/distribution/search?q=Mus'));
    expect(response.status).toBe(404);
  });
});

describe('Ausgabe-Konto (Rolle DISTRIBUTION)', () => {
  beforeEach(async () => {
    const user = await createUser('DISTRIBUTION');
    await createSession(user.id, { totpVerified: true });
  });

  it('darf keine Admin-Aktion ausfuehren', async () => {
    const result = await authorize(['ADMIN']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Keine Berechtigung');
  });

  it('bekommt den Export nicht', async () => {
    const response = await exportRoute(
      new Request('http://localhost:3000/api/admin/export?kind=details&format=xlsx'),
    );
    expect(response.status).toBe(404);
  });

  it('darf die Ausgabe bedienen', async () => {
    const result = await authorize(['ADMIN', 'DISTRIBUTION']);
    expect(result.ok).toBe(true);
  });

  it('darf die Ausgabesuche verwenden', async () => {
    const response = await searchRoute(new Request('http://localhost:3000/api/distribution/search?q=Mus'));
    expect(response.status).toBe(200);
  });

  it('braucht keinen zweiten Faktor, Admins dagegen schon', () => {
    expect(requiresTotp('DISTRIBUTION')).toBe(false);
    expect(requiresTotp('ADMIN')).toBe(true);
  });
});

describe('Admin-Konto', () => {
  beforeEach(async () => {
    const user = await createUser('ADMIN');
    await createSession(user.id, { totpVerified: true });
  });

  it('darf Admin-Aktionen ausfuehren', async () => {
    const result = await authorize(['ADMIN']);
    expect(result.ok).toBe(true);
  });

  it('bekommt den Export', async () => {
    const response = await exportRoute(
      new Request('http://localhost:3000/api/admin/export?kind=aggregate&format=csv'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
  });
});

describe('Sessionzustand', () => {
  it('gilt vor Abschluss des zweiten Faktors nicht als angemeldet', async () => {
    const user = await createUser('ADMIN');
    await createSession(user.id, { totpVerified: false });

    // Die Session existiert – aber sie zaehlt noch nicht.
    expect(await getSessionContext()).not.toBeNull();
    expect(await getAuthenticatedUser()).toBeNull();
    expect((await authorize(['ADMIN'])).ok).toBe(false);
  });

  it('speichert in der Datenbank nur den Hash des Cookie-Tokens', async () => {
    const user = await createUser('ADMIN');
    const token = await createSession(user.id, { totpVerified: true });

    const sessions = await prisma.session.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).not.toBe(token);
    expect(sessions[0]?.id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('weist ein erfundenes Cookie zurueck', async () => {
    const user = await createUser('ADMIN');
    await createSession(user.id, { totpVerified: true });

    cookieJar.set(SESSION_COOKIE, { name: SESSION_COOKIE, value: 'komplett-ausgedacht' });

    expect(await getAuthenticatedUser()).toBeNull();
  });

  it('verwirft eine abgelaufene Session und raeumt sie weg', async () => {
    const user = await createUser('ADMIN');
    await createSession(user.id, { totpVerified: true });

    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect(await getAuthenticatedUser()).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });

  it('meldet ein deaktiviertes Konto sofort ueberall ab', async () => {
    const user = await createUser('ADMIN');
    await createSession(user.id, { totpVerified: true });

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    expect(await getAuthenticatedUser()).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });
});

describe('Fremde Bestellungen', () => {
  it('sind ueber ein anderes Token nicht erreichbar', async () => {
    const { variant } = await createProductWithVariant();
    const orderA = await createPaidOrder({ variantId: variant.id, lastName: 'Mustermann' });
    const orderB = await createPaidOrder({ variantId: variant.id, lastName: 'Musterfrau' });

    const found = await findOrderByPublicToken(orderB.publicToken);

    expect(found?.id).toBe(orderB.id);
    expect(found?.id).not.toBe(orderA.id);
  });

  it('sind ueber die Bestellnummer nicht erreichbar', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id });

    // Die Bestellnummer steht auf Listen und wird vorgelesen – sie taugt nicht als Schluessel.
    expect(await findOrderByPublicToken(order.orderNumber)).toBeNull();
  });

  it('sind ueber die interne ID nicht erreichbar', async () => {
    const { variant } = await createProductWithVariant();
    const order = await createPaidOrder({ variantId: variant.id });

    expect(await findOrderByPublicToken(order.id)).toBeNull();
  });

  it('sind mit einem erfundenen Token nicht erreichbar', async () => {
    const { variant } = await createProductWithVariant();
    await createPaidOrder({ variantId: variant.id });

    expect(await findOrderByPublicToken('A'.repeat(43))).toBeNull();
  });
});
