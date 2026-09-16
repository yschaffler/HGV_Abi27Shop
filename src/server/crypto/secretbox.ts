import 'server-only';
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { env } from '../env';

/**
 * AES-256-GCM fuer Geheimnisse, die wir im Klartext zurueckbrauchen – aktuell ausschliesslich
 * die TOTP-Secrets der Admins. Passwoerter werden NICHT verschluesselt, sondern mit Argon2id
 * gehasht (siehe server/auth/password.ts).
 *
 * Bewusst keine Eigenentwicklung: AES-GCM aus node:crypto, Schluessel per HKDF aus
 * AUTH_SECRET abgeleitet, Nonce aus dem CSPRNG, Authentication Tag wird geprueft.
 */

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION = 'v1';

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const derived = hkdfSync('sha256', Buffer.from(env().AUTH_SECRET, 'utf8'), Buffer.alloc(0), Buffer.from('abishop:totp-secret:v1', 'utf8'), KEY_LENGTH);
  cachedKey = Buffer.from(derived);
  return cachedKey;
}

/** Nur fuer Tests, wenn AUTH_SECRET zwischen zwei Faellen wechselt. */
export function resetSecretboxKeyCache(): void {
  cachedKey = null;
}

/** Ergebnisformat: v1.<iv>.<tag>.<ciphertext>, alle Teile base64url. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptSecret(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unlesbares Secret-Format');
  }

  const iv = Buffer.from(parts[1] as string, 'base64url');
  const tag = Buffer.from(parts[2] as string, 'base64url');
  const ciphertext = Buffer.from(parts[3] as string, 'base64url');

  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('Unlesbares Secret-Format');
  }

  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  // final() wirft, wenn das Tag nicht passt – manipulierte Daten fliegen hier raus.
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
