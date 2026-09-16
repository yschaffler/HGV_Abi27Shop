import { beforeEach, describe, expect, it } from 'vitest';
import { checkRateLimit, clearAllRateLimits, RATE_LIMITS, resetRateLimit } from '@/lib/rate-limit';

/**
 * Rate Limiting. Die Zeit wird als Parameter hereingereicht, damit die Tests kein
 * echtes Warten brauchen.
 */

const RULE = { limit: 3, windowMs: 60_000 };

beforeEach(() => clearAllRateLimits());

describe('checkRateLimit', () => {
  it('laesst genau so viele Anfragen durch wie erlaubt', () => {
    expect(checkRateLimit('k', RULE, 0).allowed).toBe(true);
    expect(checkRateLimit('k', RULE, 0).allowed).toBe(true);
    expect(checkRateLimit('k', RULE, 0).allowed).toBe(true);
    expect(checkRateLimit('k', RULE, 0).allowed).toBe(false);
  });

  it('nennt die Wartezeit in Sekunden', () => {
    for (let i = 0; i < 3; i += 1) checkRateLimit('k', RULE, 0);

    const blocked = checkRateLimit('k', RULE, 30_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(30);
  });

  it('gibt nach Ablauf des Fensters wieder frei', () => {
    for (let i = 0; i < 3; i += 1) checkRateLimit('k', RULE, 0);
    expect(checkRateLimit('k', RULE, 0).allowed).toBe(false);
    expect(checkRateLimit('k', RULE, 60_001).allowed).toBe(true);
  });

  it('zaehlt verschiedene Schluessel unabhaengig', () => {
    for (let i = 0; i < 3; i += 1) checkRateLimit('a', RULE, 0);
    expect(checkRateLimit('a', RULE, 0).allowed).toBe(false);
    expect(checkRateLimit('b', RULE, 0).allowed).toBe(true);
  });

  it('kann nach erfolgreicher Anmeldung zurueckgesetzt werden', () => {
    for (let i = 0; i < 3; i += 1) checkRateLimit('k', RULE, 0);
    resetRateLimit('k');
    expect(checkRateLimit('k', RULE, 0).allowed).toBe(true);
  });
});

describe('RATE_LIMITS', () => {
  it('begrenzt die Anmeldung je Konto strenger als je IP', () => {
    expect(RATE_LIMITS.loginPerAccount.limit).toBeLessThan(RATE_LIMITS.login.limit);
  });

  it('begrenzt den Mailversand je Empfaenger', () => {
    expect(RATE_LIMITS.email.limit).toBeGreaterThan(0);
    expect(RATE_LIMITS.email.windowMs).toBeGreaterThanOrEqual(60_000);
  });
});
