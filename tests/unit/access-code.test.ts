import { describe, expect, it, vi } from 'vitest';

/**
 * Zugangsschranke fuer den Shop.
 *
 * Geprueft wird das, woran die Schranke haengt: dass ein gefaelschtes oder abgelaufenes
 * Cookie nicht durchkommt und dass ein Codewechsel die bereits verteilten Cookies entwertet.
 */

vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

const { createAccessCookieValue, isAccessCookieValid, normalizeCode } = await import(
  '@/server/shop/access'
);

// Steht stellvertretend fuer einen Argon2-Hash; die Schranke liest daraus nur eine Ableitung.
const HASH = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$abcdefghijklmnopqrstuvwxyz012345';
const OTHER_HASH = '$argon2id$v=19$m=19456,t=2,p=1$YW5vdGhlcg$0123456789abcdefghijklmnopqrstu';

describe('normalizeCode', () => {
  it('ignoriert Gross-/Kleinschreibung und Leerzeichen', () => {
    expect(normalizeCode('abi 27')).toBe('ABI27');
    expect(normalizeCode('  ABI27 ')).toBe('ABI27');
    expect(normalizeCode('Abi\t27\n')).toBe('ABI27');
  });
});

describe('Zugangs-Cookie', () => {
  it('akzeptiert ein frisch ausgestelltes Cookie', () => {
    const value = createAccessCookieValue(HASH);
    expect(isAccessCookieValid(value, HASH)).toBe(true);
  });

  it('lehnt ein fehlendes Cookie ab', () => {
    expect(isAccessCookieValid(undefined, HASH)).toBe(false);
    expect(isAccessCookieValid('', HASH)).toBe(false);
  });

  it('lehnt Unsinn ohne die erwartete Struktur ab', () => {
    expect(isAccessCookieValid('irgendwas', HASH)).toBe(false);
    expect(isAccessCookieValid('v1.a.b', HASH)).toBe(false);
    expect(isAccessCookieValid('v1.a.b.c.d', HASH)).toBe(false);
  });

  it('lehnt ein Cookie mit veraenderter Ablaufzeit ab', () => {
    const value = createAccessCookieValue(HASH);
    const parts = value.split('.');
    const weiterInDerZukunft = [parts[0], parts[1], String(Number(parts[2]) + 86_400), parts[3]].join('.');

    expect(isAccessCookieValid(weiterInDerZukunft, HASH)).toBe(false);
  });

  it('lehnt ein Cookie mit gefaelschter Signatur ab', () => {
    const value = createAccessCookieValue(HASH);
    const parts = value.split('.');

    expect(isAccessCookieValid([parts[0], parts[1], parts[2], 'gefaelscht'].join('.'), HASH)).toBe(false);
  });

  it('lehnt ein abgelaufenes Cookie ab', () => {
    const ausgestellt = Date.parse('2026-01-01T00:00:00Z');
    const value = createAccessCookieValue(HASH, ausgestellt);

    // 30 Tage plus eine Sekunde spaeter.
    const spaeter = ausgestellt + (30 * 24 * 60 * 60 + 1) * 1000;
    expect(isAccessCookieValid(value, HASH, spaeter)).toBe(false);
  });

  it('entwertet bestehende Cookies, wenn der Code gewechselt wird', () => {
    const value = createAccessCookieValue(HASH);

    expect(isAccessCookieValid(value, HASH)).toBe(true);
    expect(isAccessCookieValid(value, OTHER_HASH)).toBe(false);
  });

  it('enthaelt den Hash nicht im Klartext', () => {
    const value = createAccessCookieValue(HASH);
    expect(value).not.toContain(HASH);
    expect(value).not.toContain('argon2id');
  });
});
