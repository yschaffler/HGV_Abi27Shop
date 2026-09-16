import { describe, expect, it } from 'vitest';
import {
  createOrderNumber,
  createPublicToken,
  createRecoveryCode,
  createSessionToken,
  hashSessionToken,
  normalizeRecoveryCode,
  safeEquals,
} from '@/server/crypto/tokens';
import { decryptSecret, encryptSecret } from '@/server/crypto/secretbox';

/**
 * Zufallswerte und Verschluesselung.
 *
 * Die zentrale Zusage des Zugriffsmodells lautet: Eine fremde Bestellung ist ueber die URL
 * nicht erreichbar. Das steht und faellt mit der Entropie des Tokens.
 */

describe('createPublicToken', () => {
  it('hat 256 Bit Entropie (43 Zeichen base64url)', () => {
    const token = createPublicToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('liefert bei tausend Aufrufen tausend verschiedene Werte', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => createPublicToken()));
    expect(tokens.size).toBe(1000);
  });

  it('ist nicht hochzaehlbar – aufeinanderfolgende Tokens haben nichts gemeinsam', () => {
    const [first, second] = [createPublicToken(), createPublicToken()];
    const sharedPrefix = [...first].findIndex((char, index) => char !== second[index]);
    // Ein gemeinsamer Praefix von mehr als ein paar Zeichen waere ein Alarmzeichen.
    expect(sharedPrefix).toBeLessThan(6);
  });
});

describe('createOrderNumber', () => {
  it('hat das Format ABI-XXXXXX', () => {
    expect(createOrderNumber()).toMatch(/^ABI-[0-9A-HJKMNP-TV-Z]{6}$/);
  });

  it('verwendet keine verwechselbaren Zeichen (I, L, O, U)', () => {
    // Nur der Zufallsteil zaehlt – das feste Praefix "ABI" enthaelt naturgemaess ein I.
    const suffixes = Array.from({ length: 300 }, () => createOrderNumber().slice(4)).join('');
    expect(suffixes).not.toMatch(/[ILOU]/);
  });

  it('ist praktisch immer verschieden', () => {
    const numbers = new Set(Array.from({ length: 500 }, () => createOrderNumber()));
    // Bei rund 10^9 Moeglichkeiten sind Kollisionen unter 500 Ziehungen sehr unwahrscheinlich.
    expect(numbers.size).toBeGreaterThan(495);
  });
});

describe('hashSessionToken', () => {
  it('erzeugt zu gleichen Tokens gleiche Hashes', () => {
    const token = createSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it('gibt das Token selbst nicht preis', () => {
    const token = createSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });
});

describe('safeEquals', () => {
  it('erkennt gleiche Werte', () => {
    expect(safeEquals('abc', 'abc')).toBe(true);
  });

  it('erkennt unterschiedliche Werte', () => {
    expect(safeEquals('abc', 'abd')).toBe(false);
  });

  it('kommt mit unterschiedlichen Laengen zurecht', () => {
    expect(safeEquals('abc', 'abcd')).toBe(false);
  });
});

describe('Notfallcodes', () => {
  it('haben ein gut abschreibbares Format', () => {
    expect(createRecoveryCode()).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  });

  it('werden vor dem Vergleich von Bindestrichen und Kleinschreibung befreit', () => {
    expect(normalizeRecoveryCode(' abcd-efgh-jkmn ')).toBe('ABCDEFGHJKMN');
  });
});

describe('AES-256-GCM (TOTP-Secrets)', () => {
  it('verschluesselt und entschluesselt verlustfrei', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('erzeugt bei gleichem Klartext unterschiedliche Chiffrate (zufaellige Nonce)', () => {
    expect(encryptSecret('JBSWY3DPEHPK3PXP')).not.toBe(encryptSecret('JBSWY3DPEHPK3PXP'));
  });

  it('erkennt manipulierte Daten am Authentication Tag', () => {
    const payload = encryptSecret('JBSWY3DPEHPK3PXP');
    const parts = payload.split('.');

    // Ein einzelnes Bit im Chiffrat kippen.
    const ciphertext = Buffer.from(parts[3] as string, 'base64url');
    ciphertext[0] = (ciphertext[0] ?? 0) ^ 0x01;
    const tampered = [parts[0], parts[1], parts[2], ciphertext.toString('base64url')].join('.');

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('lehnt ein unbekanntes Format ab', () => {
    expect(() => decryptSecret('nur-irgendein-string')).toThrow();
    expect(() => decryptSecret('v2.a.b.c')).toThrow();
  });
});
