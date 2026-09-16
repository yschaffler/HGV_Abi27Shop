import { describe, expect, it, vi } from 'vitest';

/**
 * Expliziter Origin-Check für zustandsändernde Aufrufe.
 *
 * Next.js prüft bei Server Actions selbst Origin gegen Host, lässt laut Dokumentation aber
 * Requests ganz ohne Origin-Header mit einer Warnung durch. Genau diese Lücke schliesst
 * assertSameOrigin – und das wird hier nachgewiesen.
 */

let currentHeaders = new Headers();

vi.mock('next/headers', () => ({
  headers: async () => currentHeaders,
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

const { assertSameOrigin } = await import('@/server/request-context');

function withHeaders(entries: Record<string, string>) {
  currentHeaders = new Headers(entries);
}

describe('assertSameOrigin', () => {
  it('lässt die eigene Origin durch', async () => {
    withHeaders({ origin: 'http://localhost:3000', host: 'localhost:3000' });
    expect((await assertSameOrigin()).ok).toBe(true);
  });

  it('weist eine fremde Origin ab', async () => {
    withHeaders({ origin: 'https://boese.example', host: 'localhost:3000' });

    const result = await assertSameOrigin();
    expect(result.ok).toBe(false);
  });

  it('weist einen Aufruf ganz ohne Origin-Header ab', async () => {
    // Das ist der Fall, den Next.js von sich aus nur mit einer Warnung durchliesse.
    withHeaders({ host: 'localhost:3000' });

    const result = await assertSameOrigin();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('neu laden');
  });

  it('weist eine kaputte Origin-Angabe ab', async () => {
    withHeaders({ origin: 'kein-gueltiger-wert', host: 'localhost:3000' });
    expect((await assertSameOrigin()).ok).toBe(false);
  });

  it('akzeptiert den Host, unter dem der Request tatsächlich hereinkam', async () => {
    // Deckt Reverse-Proxy-Setups ab, in denen die öffentliche Adresse umgeschrieben wird.
    withHeaders({ origin: 'https://abishop.example.de', 'x-forwarded-host': 'abishop.example.de' });
    expect((await assertSameOrigin()).ok).toBe(true);
  });

  it('lässt sich nicht durch einen gefälschten X-Forwarded-Host austricksen, der nicht zur Origin passt', async () => {
    withHeaders({ origin: 'https://boese.example', 'x-forwarded-host': 'abishop.example.de' });
    expect((await assertSameOrigin()).ok).toBe(false);
  });
});
