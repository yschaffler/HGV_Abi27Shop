import 'server-only';
import { headers } from 'next/headers';
import { env } from './env';

/**
 * Client-IP fuer das Rate Limiting.
 *
 * X-Forwarded-For wird nur ausgewertet, wenn TRUST_PROXY_HEADERS gesetzt ist. Andernfalls
 * koennte jeder Client sein eigenes Limit durch einen gefaelschten Header aushebeln.
 * Ohne vertrauenswuerdigen Proxy faellt alles auf denselben Schluessel zurueck – das ist
 * strenger als noetig, aber niemals unsicherer.
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
 * Zusaetzlicher Origin-Check fuer Route Handler, die Zustand aendern.
 * Server Actions bringen diese Pruefung bereits mit; Route Handler nicht.
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
