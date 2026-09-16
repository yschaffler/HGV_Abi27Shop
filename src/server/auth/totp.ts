import 'server-only';
import { generateSecret, generateURI, verify as verifyOtp } from 'otplib';
import { decryptSecret, encryptSecret } from '../crypto/secretbox';

/**
 * Zweiter Faktor nach RFC 6238 (TOTP) – kompatibel mit jeder gängigen Authenticator-App.
 *
 * Das Secret liegt in der Datenbank ausschließlich AES-256-GCM-verschlüsselt. Ein Dump der
 * Datenbank allein reicht damit nicht, um gültige Codes zu erzeugen.
 */

/** Ein Zeitschritt Toleranz in jede Richtung, damit leicht falsch gehende Uhren funktionieren. */
const EPOCH_TOLERANCE_SECONDS = 30;

export type TotpEnrollment = {
  /** Klartext-Secret – nur für die Einrichtung, wird nie gespeichert. */
  secret: string;
  /** Verschlüsselte Form für die Datenbank. */
  encryptedSecret: string;
  /** otpauth://-URI für den QR-Code. */
  uri: string;
};

export function createTotpEnrollment(params: { accountEmail: string; issuer: string }): TotpEnrollment {
  const secret = generateSecret({ length: 20 });

  return {
    secret,
    encryptedSecret: encryptSecret(secret),
    uri: generateURI({
      issuer: params.issuer,
      label: params.accountEmail,
      secret,
    }),
  };
}

/** Akzeptiert Eingaben mit Leerzeichen ("123 456") und verwirft alles andere. */
export function normalizeTotpCode(input: string): string {
  return input.replace(/\s/g, '');
}

export async function verifyTotpCode(encryptedSecret: string, code: string): Promise<boolean> {
  const normalized = normalizeTotpCode(code);
  if (!/^\d{6}$/.test(normalized)) return false;

  let secret: string;
  try {
    secret = decryptSecret(encryptedSecret);
  } catch {
    return false;
  }

  try {
    const result = await verifyOtp({
      secret,
      token: normalized,
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
    });
    return result.valid;
  } catch {
    return false;
  }
}
