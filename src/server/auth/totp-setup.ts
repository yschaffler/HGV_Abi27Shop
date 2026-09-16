import 'server-only';
import { prisma } from '../db';
import { createRecoveryCode } from '../crypto/tokens';
import { createTotpEnrollment, restoreTotpEnrollment, verifyTotpCode } from './totp';
import { replaceRecoveryCodes } from './login';
import { recordAudit } from '../audit';

/**
 * Einrichtung des zweiten Faktors.
 *
 * Das Secret wird beim ersten Aufruf der Einrichtungsseite erzeugt, sofort verschlüsselt
 * gespeichert und danach wiederverwendet, solange es nicht bestätigt ist. Dadurch geht
 * ein bereits gescannter QR-Code beim Neuladen der Seite nicht verloren – und das Secret
 * muss nie durch ein Formularfeld im Browser hin und zurück wandern.
 */

const RECOVERY_CODE_COUNT = 8;

export type TotpSetupData = {
  uri: string;
  /** Base32-Secret zum manuellen Eintippen, falls die Kamera streikt. */
  manualKey: string;
};

export async function beginOrResumeTotpSetup(userId: string, issuer: string): Promise<TotpSetupData> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, totpSecret: true, totpConfirmedAt: true },
  });

  if (user.totpConfirmedAt) {
    throw new Error('Der zweite Faktor ist bereits eingerichtet');
  }

  // Noch kein Secret gespeichert: eins erzeugen und verschlüsselt ablegen.
  if (!user.totpSecret) {
    const enrollment = createTotpEnrollment({ accountEmail: user.email, issuer });
    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: enrollment.encryptedSecret },
    });
    return { uri: enrollment.uri, manualKey: enrollment.secret };
  }

  const restored = restoreTotpEnrollment({
    encryptedSecret: user.totpSecret,
    accountEmail: user.email,
    issuer,
  });

  return { uri: restored.uri, manualKey: restored.secret };
}

export type TotpConfirmResult =
  | { ok: true; recoveryCodes: string[] }
  | { ok: false; message: string };

/**
 * Bestätigt die Einrichtung mit einem Code aus der App und erzeugt die Notfallcodes.
 * Die Codes werden genau einmal im Klartext zurückgegeben; gespeichert sind nur Hashes.
 */
export async function confirmTotpSetup(userId: string, code: string): Promise<TotpConfirmResult> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, totpSecret: true, totpConfirmedAt: true },
  });

  if (user.totpConfirmedAt) return { ok: false, message: 'Der zweite Faktor ist bereits eingerichtet.' };
  if (!user.totpSecret) return { ok: false, message: 'Die Einrichtung wurde nicht gestartet.' };

  const valid = await verifyTotpCode(user.totpSecret, code);
  if (!valid) return { ok: false, message: 'Der Code stimmt nicht. Bitte erneut versuchen.' };

  const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => createRecoveryCode());

  await prisma.user.update({
    where: { id: userId },
    data: { totpConfirmedAt: new Date() },
  });
  await replaceRecoveryCodes(userId, recoveryCodes);

  await recordAudit({
    actor: { id: userId, email: user.email },
    action: 'USER_TOTP_RESET',
    entityType: 'User',
    entityId: userId,
    summary: 'Zweiter Faktor eingerichtet und Notfallcodes erzeugt',
  });

  return { ok: true, recoveryCodes };
}
