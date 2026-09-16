import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sicherheits-Header und CSP für jede Antwort.
 *
 * Seit Next.js 16 heißt diese Datei "proxy" statt "middleware"; die Aufgabe ist dieselbe.
 *
 * WICHTIG: Die Weiterleitung nicht angemeldeter Besucher weiter unten ist reiner Komfort.
 * Sie prüft nur, ob überhaupt ein Session-Cookie existiert – nicht, ob es gültig ist oder
 * welche Rolle dahintersteht. Die echte Autorisierung passiert serverseitig in jeder
 * Admin-Seite und jeder Action (src/server/auth/rbac.ts). Wer diese Datei löscht, verliert
 * Komfort, aber keinen Schutz.
 */

const SESSION_COOKIE = 'abishop_session';

function buildContentSecurityPolicy(nonce: string, isDevelopment: boolean): string {
  const directives = [
    `default-src 'self'`,
    // 'strict-dynamic' erlaubt es den mit Nonce geladenen Next-Skripten, weitere Chunks
    // nachzuladen, ohne dass wir jede Datei einzeln freigeben müssen.
    // Im Dev-Modus braucht der React Refresh Runtime zusätzlich eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDevelopment ? "'unsafe-eval'" : ''}`.trim(),
    // Tailwind und Next setzen Style-Attribute inline. Inline-Styles sind kein XSS-Vektor
    // in dem Sinne, wie es Skripte sind; die Alternative wäre ein Nonce an jedem Element.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    // Kein externer Endpunkt nötig: Stripe Checkout läuft als Weiterleitung, nicht als iframe.
    `connect-src 'self'${isDevelopment ? ' ws: wss:' : ''}`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'none'`,
    `object-src 'none'`,
  ];

  if (!isDevelopment) directives.push('upgrade-insecure-requests');

  return directives.join('; ');
}

export default function proxy(request: NextRequest): NextResponse {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = buildContentSecurityPolicy(nonce, isDevelopment);

  // Next liest die CSP aus dem Request-Header und hängt den Nonce an seine eigenen Skripte.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const { pathname } = request.nextUrl;
  const needsSession = pathname.startsWith('/admin');

  if (needsSession && !request.cookies.get(SESSION_COOKIE)) {
    const loginUrl = new URL('/login', request.url);
    // Nur den Pfad weitergeben, niemals eine vollständige URL – sonst wäre das ein
    // offener Redirect, mit dem man Besucher auf fremde Seiten leiten könnte.
    loginUrl.searchParams.set('weiter', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set('content-security-policy', csp);
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  response.headers.set('x-dns-prefetch-control', 'off');

  if (!isDevelopment) {
    response.headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Alles außer den Interna von Next (_next/*) und dem Stripe-Webhook.
     *
     * _next/* liefert statische Assets und im Entwicklungsmodus den HMR-WebSocket – dort
     * hat der Proxy nichts zu suchen und würde die Verbindung nur stören.
     * Der Webhook braucht weder CSP noch Cookies; zwischen Stripe und der Signaturprüfung
     * soll so wenig wie möglich liegen.
     */
    '/((?!_next/|favicon.ico|api/stripe/webhook).*)',
  ],
};
