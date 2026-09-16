import 'server-only';
import { prisma } from '../db';
import { recordAudit } from '../audit';
import { logger } from '../logger';
import { burnTimeForUnknownUser, hashPassword, verifyPassword } from './password';
import { createSession, destroyAllSessionsForUser, purgeExpiredSessions } from './session';
import { requiresTotp } from './rbac';
import { normalizeRecoveryCode } from '../crypto/tokens';

/**
 * Anmeldelogik inklusive Brute-Force-Schutz.
 *
 * Zwei Bremsen greifen ineinander:
 *  1. Rate Limiting je IP (im Aufrufer, In-Memory) – bremst Massenversuche sofort ab.
 *  2. Kontosperre in der Datenbank – überlebt einen Neustart der Anwendung und schützt
 *     ein einzelnes Konto auch gegen verteilte Versuche.
 *
 * Die Fehlermeldung ist immer dieselbe, egal ob die E-Mail existiert, das Passwort falsch ist
 * oder das Konto gesperrt ist. Andernfalls wäre über die Anmeldemaske herauszufinden,
 * welche Adressen überhaupt Konten haben.
 */

const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MINUTES = 15;

export const GENERIC_LOGIN_ERROR = 'E-Mail-Adresse oder Passwort ist falsch.';

export type LoginOutcome =
  | { ok: true; next: 'TOTP_SETUP' | 'TOTP_VERIFY' | 'DONE' }
  | { ok: false; message: string };

export async function attemptLogin(email: string, password: string): Promise<LoginOutcome> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || !user.isActive) {
    // Gleiche Rechenzeit wie bei einem existierenden Konto.
    await burnTimeForUnknownUser(password);
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await burnTimeForUnknownUser(password);
    logger.warn('Anmeldeversuch auf gesperrtem Konto', { userId: user.id });
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  const passwordMatches = await verifyPassword(user.passwordHash, password);

  if (!passwordMatches) {
    const failedAttempts = user.failedLoginAttempts + 1;
    const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: failedAttempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : user.lockedUntil,
      },
    });

    await recordAudit({
      actor: { id: user.id, email: user.email },
      action: 'LOGIN_FAILED',
      entityType: 'User',
      entityId: user.id,
      summary: shouldLock
        ? `Fehlversuch ${failedAttempts}, Konto für ${LOCKOUT_MINUTES} Minuten gesperrt`
        : `Fehlversuch ${failedAttempts}`,
    });

    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const hasTotp = user.totpConfirmedAt !== null;
  const mustSetUpTotp = !hasTotp && requiresTotp(user.role);

  // Session Fixation: es wird immer ein frisches Token ausgestellt.
  await createSession(user.id, { totpVerified: !hasTotp && !mustSetUpTotp });

  // Gelegenheit zum Aufräumen, ohne dafür einen Cronjob zu brauchen.
  void purgeExpiredSessions().catch(() => undefined);

  if (mustSetUpTotp) return { ok: true, next: 'TOTP_SETUP' };
  if (hasTotp) return { ok: true, next: 'TOTP_VERIFY' };

  await recordAudit({
    actor: { id: user.id, email: user.email },
    action: 'LOGIN_SUCCESS',
    entityType: 'User',
    entityId: user.id,
    summary: `Anmeldung ohne zweiten Faktor (Rolle ${user.role})`,
  });

  return { ok: true, next: 'DONE' };
}

/**
 * Prüft einen Notfallcode und verbraucht ihn. Codes sind Argon2-gehasht gespeichert,
 * deshalb muss gegen alle offenen Codes des Benutzers geprüft werden.
 */
export async function consumeRecoveryCode(userId: string, input: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(input);
  if (normalized.length < 8) return false;

  const openCodes = await prisma.recoveryCode.findMany({ where: { userId, usedAt: null } });

  for (const candidate of openCodes) {
    if (await verifyPassword(candidate.codeHash, normalized)) {
      // Bedingtes Update: zwei gleichzeitige Versuche können denselben Code nicht zweimal einlösen.
      const consumed = await prisma.recoveryCode.updateMany({
        where: { id: candidate.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      return consumed.count === 1;
    }
  }

  return false;
}

/** Ersetzt alle Notfallcodes eines Benutzers und liefert die Klartextcodes genau einmal zurück. */
export async function replaceRecoveryCodes(userId: string, codes: string[]): Promise<void> {
  const hashed = await Promise.all(
    codes.map(async (code) => ({ userId, codeHash: await hashPassword(normalizeRecoveryCode(code)) })),
  );

  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({ data: hashed }),
  ]);
}

/** Nach einem Passwortwechsel gelten alle bestehenden Sessions als verbrannt. */
export async function changePassword(userId: string, newPassword: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), failedLoginAttempts: 0, lockedUntil: null },
  });
  await destroyAllSessionsForUser(userId);
}
