import 'server-only';
import { headers } from 'next/headers';
import { env } from './env';
import { logger } from './logger';

/**
 * Client-IP für das Rate Limiting.
 *
 * X-Forwarded-For wird nur ausgewertet, wenn TRUST_PROXY_HEADERS gesetzt ist. Andernfalls
 * könnte jeder Client sein eigenes Limit durch einen gefälschten Header aushebeln.
 * Ohne vertrauenswürdigen Proxy fällt alles auf denselben Schlüssel zurück – das ist
 * strenger als nötig, aber niemals unsicherer.
 */
export async function clientIp(): Promise<string> {
  if (!env().TRUST_PROXY_HEADERS) return 'direct';

  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headerList.get('x-real-ip')?.trim() || 'direct';
}

export type OriginCheck = { ok: true } | { ok: false; message: string };

/**
 * Expliziter Origin-Check für zustandsändernde Aufrufe.
 *
 * Next.js vergleicht bei Server Actions von sich aus Origin und Host. Die Dokumentation
 * hält dabei aber ausdrücklich fest: Ein Request GANZ OHNE Origin-Header wird nur mit einer
 * Warnung durchgelassen, nicht abgewiesen. Browser senden bei POST immer einen Origin,
 * also kostet es uns nichts, hier auf dessen Vorhandensein zu bestehen – und schliesst
 * die Lücke für alles, was kein Browser ist.
 *
 * Zweiter Schutz auf einer anderen Ebene: Das Session-Cookie ist SameSite=Lax. Eine
 * fremde Seite bekommt bei einem seitenübergreifenden POST also ohnehin keine Session
 * mitgeschickt und könnte selbst bei umgangenem Origin-Check nichts Angemeldetes auslösen.
 */
export async function assertSameOrigin(): Promise<OriginCheck> {
  const headerList = await headers();
  const origin = headerList.get('origin');

  if (!origin) {
    logger.warn('Zustandsändernder Aufruf ohne Origin-Header abgewiesen');
    return { ok: false, message: 'Die Anfrage konnte nicht zugeordnet werden. Bitte Seite neu laden.' };
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return { ok: false, message: 'Die Anfrage konnte nicht zugeordnet werden. Bitte Seite neu laden.' };
  }

  // Zulässig ist die konfigurierte öffentliche Adresse ...
  const configuredHost = new URL(env().APP_URL).host;

  // ... oder der Host, unter dem dieser Request tatsächlich hereinkam. Letzteres deckt
  // Setups ab, in denen ein Reverse Proxy die Adresse umschreibt.
  const requestHost = headerList.get('x-forwarded-host') ?? headerList.get('host');

  if (originHost === configuredHost || (requestHost !== null && originHost === requestHost)) {
    return { ok: true };
  }

  logger.warn('Zustandsändernder Aufruf mit fremdem Origin abgewiesen', { originHost });
  return { ok: false, message: 'Die Anfrage konnte nicht zugeordnet werden. Bitte Seite neu laden.' };
}
