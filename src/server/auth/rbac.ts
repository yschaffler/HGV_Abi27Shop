import 'server-only';
import { redirect } from 'next/navigation';
import type { Role } from '@/generated/prisma/enums';
import { getSessionContext, type AuthUser } from './session';

/**
 * Autorisierung.
 *
 * Grundsatz: Jede geschützte Seite und jede zustandsändernde Action ruft hier hinein.
 * Der Proxy (src/proxy.ts) leitet nicht angemeldete Besucher früh um, ist aber ausdrücklich
 * nur Komfort – niemals der eigentliche Schutz. Ein ausgeblendeter Button ist gar kein Schutz.
 */

export const ROLES_WITH_ADMIN_ACCESS: Role[] = ['ADMIN'];
export const ROLES_WITH_DISTRIBUTION_ACCESS: Role[] = ['ADMIN', 'DISTRIBUTION'];

/**
 * Für ADMIN ist der zweite Faktor Pflicht. Ein DISTRIBUTION-Konto bedient nur die
 * Ausgabeliste an einem gemeinsam genutzten iPad und darf ohne 2FA arbeiten, wenn
 * keins eingerichtet ist – das ist eine bewusste Abwägung und in SECURITY.md dokumentiert.
 */
export function requiresTotp(role: Role): boolean {
  return role === 'ADMIN';
}

/** Liefert den angemeldeten Benutzer oder null. Wirft nicht und leitet nicht um. */
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const context = await getSessionContext();
  if (!context) return null;
  if (!context.totpVerified) return null;
  return context.user;
}

export function hasRole(user: AuthUser | null, allowed: Role[]): boolean {
  return user !== null && allowed.includes(user.role);
}

/**
 * Für Server Components: leitet zum Login um, wenn die Rolle nicht passt.
 * `redirect()` wirft intern – der Code danach wird nie erreicht.
 */
export async function requireUser(allowed: Role[]): Promise<AuthUser> {
  const user = await getAuthenticatedUser();

  if (!user) redirect('/login');
  if (!allowed.includes(user.role)) {
    // Kein 403 mit Details: wer die Rolle nicht hat, erfährt nicht, dass es die Seite gibt.
    redirect('/login?fehler=keine-berechtigung');
  }

  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  return requireUser(ROLES_WITH_ADMIN_ACCESS);
}

export async function requireDistributionAccess(): Promise<AuthUser> {
  return requireUser(ROLES_WITH_DISTRIBUTION_ACCESS);
}

export type AuthorizationFailure = { ok: false; error: string };

/**
 * Für Server Actions und Route Handler: statt umzuleiten wird ein Ergebnis zurückgegeben,
 * damit der Aufrufer sauber antworten kann.
 */
export async function authorize(
  allowed: Role[],
): Promise<{ ok: true; user: AuthUser } | AuthorizationFailure> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet.' };
  if (!allowed.includes(user.role)) return { ok: false, error: 'Keine Berechtigung für diese Aktion.' };
  return { ok: true, user };
}
