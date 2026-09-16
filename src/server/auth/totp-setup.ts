import 'server-only';
import { prisma } from '../db';
import { createRecoveryCode } from '../crypto/tokens';
import { createTotpEnrollment, restoreTotpEnrollment, verifyTotpCode } from './totp';
import { decryptSecret, encryptSecret } from '../crypto/secretbox';
import { replaceRecoveryCodes } from './login';
import { recordAudit } from '../audit';

/**
 * Einrichtung des zweiten Faktors.
 *
 * Reihenfolge ist hier bewusst so gewählt, dass die Notfallcodes nicht verloren gehen können:
 *
 * QR-Code UND Notfallcodes werden zusammen beim Öffnen der Einrichtungsseite erzeugt und
 * gemeinsam angezeigt – nicht erst nach der Bestätigung. Der erste Entwurf zeigte die Codes
 * als Ergebnis der Bestätigungs-Action an; wird das Formular ohne JavaScript abgeschickt,
 * rendert Next danach aber die Seite neu, sie leitet wegen des nun eingerichteten zweiten
 * Faktors weiter – und die Codes wären für immer weg.
 *
 * Damit ein erneutes Rendern der Seite nicht jedes Mal NEUE Codes erzeugt (Next rendert im
 * Entwicklungsmodus doppelt, und ein simpler Reload zählt ohnehin), liegen die Codes während
 * der Einrichtung zusätzlich AES-256-GCM-verschlüsselt am Benutzer. Diese Funktion ist
 * dadurch idempotent: Existiert ein Satz, wird genau dieser wieder angezeigt.
 *
 * Mit der Bestätigung wird die verschlüsselte Kopie gelöscht. Danach existieren ausschliesslich
 * Argon2-Hashes, und niemand – auch kein Admin – kann die Codes erneut anzeigen.
 */

const RECOVERY_CODE_COUNT = 8;

export type TotpSetupData = {
  uri: string;
  /** Base32-Secret zum manuellen Eintippen, falls die Kamera streikt. */
  manualKey: string;
  /** Klartext-Notfallcodes. Gespeichert werden nur deren Hashes. */
  recoveryCodes: string[];
};

export async function beginOrResumeTotpSetup(userId: string, issuer: string): Promise<TotpSetupData> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, totpSecret: true, totpConfirmedAt: true, pendingRecoveryCodes: true },
  });

  if (user.totpConfirmedAt) {
    throw new Error('Der zweite Faktor ist bereits eingerichtet');
  }

  // Das Secret bleibt über einen Seiten-Neuaufbau hinweg erhalten, damit ein bereits
  // gescannter QR-Code weiter gilt.
  let uri: string;
  let manualKey: string;

  if (user.totpSecret) {
    const restored = restoreTotpEnrollment({
      encryptedSecret: user.totpSecret,
      accountEmail: user.email,
      issuer,
    });
    uri = restored.uri;
    manualKey = restored.secret;
  } else {
    const enrollment = createTotpEnrollment({ accountEmail: user.email, issuer });
    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: enrollment.encryptedSecret },
    });
    uri = enrollment.uri;
    manualKey = enrollment.secret;
  }

  // Notfallcodes: vorhandene wiederverwenden, sonst einen Satz erzeugen. Dadurch bleibt
  // diese Funktion idempotent und ein zweites Rendern ändert nichts.
  let recoveryCodes: string[];

  if (user.pendingRecoveryCodes) {
    recoveryCodes = JSON.parse(decryptSecret(user.pendingRecoveryCodes)) as string[];
  } else {
    recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => createRecoveryCode());
    await replaceRecoveryCodes(userId, recoveryCodes);
    await prisma.user.update({
      where: { id: userId },
      data: { pendingRecoveryCodes: encryptSecret(JSON.stringify(recoveryCodes)) },
    });
  }

  return { uri, manualKey, recoveryCodes };
}

export type TotpConfirmResult = { ok: true } | { ok: false; message: string };

/** Bestätigt die Einrichtung mit einem Code aus der Authenticator-App. */
export async function confirmTotpSetup(userId: string, code: string): Promise<TotpConfirmResult> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, totpSecret: true, totpConfirmedAt: true },
  });

  if (user.totpConfirmedAt) return { ok: false, message: 'Der zweite Faktor ist bereits eingerichtet.' };
  if (!user.totpSecret) return { ok: false, message: 'Die Einrichtung wurde nicht gestartet.' };

  const valid = await verifyTotpCode(user.totpSecret, code);
  if (!valid) return { ok: false, message: 'Der Code stimmt nicht. Bitte erneut versuchen.' };

  // Mit der Bestätigung verschwindet die entschlüsselbare Kopie der Notfallcodes.
  // Ab hier existieren nur noch deren Hashes.
  await prisma.user.update({
    where: { id: userId },
    data: { totpConfirmedAt: new Date(), pendingRecoveryCodes: null },
  });

  await recordAudit({
    actor: { id: userId, email: user.email },
    action: 'USER_TOTP_RESET',
    entityType: 'User',
    entityId: userId,
    summary: 'Zweiter Faktor eingerichtet',
  });

  return { ok: true };
}
