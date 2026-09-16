import 'server-only';
import { cookies } from 'next/headers';
import { prisma } from '../db';
import { env, isProduction } from '../env';
import { createSessionToken, hashSessionToken } from '../crypto/tokens';
import type { Role } from '@/generated/prisma/enums';

/**
 * Serverseitige Sessions.
 *
 * Das Cookie enthält ein zufälliges 256-Bit-Token. In der Datenbank steht nur dessen
 * SHA-256-Hash – ein Datenbank-Leak liefert damit keine benutzbaren Sessions. Abmelden
 * löscht die Zeile, die Session ist danach sofort und serverseitig ungültig (anders als
 * bei einem JWT, das man nicht zurückrufen kann).
 */

export const SESSION_COOKIE = 'abishop_session';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  totpConfirmed: boolean;
};

export type SessionContext = {
  user: AuthUser;
  sessionId: string;
  /** false = Session steckt noch im 2FA-Schritt und darf sonst nichts. */
  totpVerified: boolean;
};

function maxAgeMs(): number {
  return env().SESSION_MAX_AGE_HOURS * 60 * 60 * 1000;
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    // In der Entwicklung läuft der Server auf http – dort würde ein Secure-Cookie nie ankommen.
    secure: isProduction(),
    sameSite: 'lax' as const,
    path: '/',
    expires,
  };
}

/**
 * Legt eine neue Session an und setzt das Cookie.
 * Wird nach jedem erfolgreichen Login aufgerufen, damit ein eventuell untergeschobenes
 * Token durch ein frisches ersetzt wird (Session Fixation).
 */
export async function createSession(userId: string, options: { totpVerified: boolean }): Promise<string> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + maxAgeMs());

  await prisma.session.create({
    data: {
      id: hashSessionToken(token),
      userId,
      totpVerified: options.totpVerified,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, cookieOptions(expiresAt));

  return token;
}

export async function markSessionTotpVerified(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { totpVerified: true },
  });
}

/** Nur alle paar Minuten schreiben – sonst erzeugt jeder Seitenaufruf einen DB-Write. */
const LAST_USED_REFRESH_MS = 5 * 60 * 1000;

/**
 * Liest die Session inklusive Benutzer. Liefert auch Sessions, die den 2FA-Schritt noch nicht
 * abgeschlossen haben – Aufrufer müssen `totpVerified` auswerten. Für den Normalfall gibt es
 * `getAuthenticatedUser()` in rbac.ts, das genau das bereits erledigt.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessionId = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { id: sessionId } });
    return null;
  }

  // Deaktivierte Konten verlieren ihren Zugang sofort, ohne dass jemand Cookies löschen muss.
  if (!session.user.isActive) {
    await prisma.session.deleteMany({ where: { userId: session.userId } });
    return null;
  }

  if (Date.now() - session.lastUsedAt.getTime() > LAST_USED_REFRESH_MS) {
    await prisma.session.update({ where: { id: sessionId }, data: { lastUsedAt: new Date() } });
  }

  return {
    sessionId,
    totpVerified: session.totpVerified,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      totpConfirmed: session.user.totpConfirmedAt !== null,
    },
  };
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { id: hashSessionToken(token) } });
  }

  cookieStore.delete(SESSION_COOKIE);
}

/** Nach Passwortwechsel oder Deaktivierung: alle Geräte abmelden. */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/** Aufräumen abgelaufener Sessions; wird beim Login nebenbei mit erledigt. */
export async function purgeExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
}
