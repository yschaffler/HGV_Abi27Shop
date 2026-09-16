import 'server-only';
import { headers } from 'next/headers';
import { env } from './env';

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

/**
 * Zusätzlicher Origin-Check für Route Handler, die Zustand ändern.
 * Server Actions bringen diese Prüfung bereits mit; Route Handler nicht.
 */
export async function isSameOriginRequest(): Promise<boolean> {
  const headerList = await headers();
  const origin = headerList.get('origin');
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(env().APP_URL).origin;
  } catch {
    return false;
  }
}
