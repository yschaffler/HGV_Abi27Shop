import 'server-only';
import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';
import { ARGON2_OPTIONS } from '@/lib/argon2-params';

/**
 * Passwort-Hashing mit Argon2id (Parameter siehe lib/argon2-params.ts).
 *
 * Argon2 bringt den Salt selbst mit und schreibt saemtliche Parameter in den Hash-String –
 * deshalb gibt es hier weder eine Salt-Spalte noch eine Parameter-Spalte in der Datenbank.
 */

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    // Kaputter oder fremder Hash-String: als "passt nicht" behandeln, nie als Ausnahme
    // nach aussen geben.
    return false;
  }
}

/**
 * Passwortregeln fuer Admin-Konten. Laenge schlaegt Zeichenklassen-Akrobatik (NIST SP 800-63B),
 * deshalb ein hohes Minimum statt erzwungener Sonderzeichen.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Mindestens 12 Zeichen')
  .max(200, 'Hoechstens 200 Zeichen')
  .refine((value) => value.trim().length >= 12, 'Mindestens 12 Zeichen ohne Leerraum am Rand');

/**
 * Konstanter Zeitaufwand fuer unbekannte Benutzer.
 *
 * Wenn keine E-Mail-Adresse passt, wird trotzdem eine echte Argon2-Verifikation gegen einen
 * Wegwerf-Hash gerechnet. Ohne das verraet die Antwortzeit, welche Adressen existieren
 * (User Enumeration). Der Wegwerf-Hash wird beim ersten Bedarf einmalig erzeugt, damit er
 * exakt dieselben Parameter hat wie echte Hashes.
 */
let dummyHashPromise: Promise<string> | null = null;

export async function burnTimeForUnknownUser(plain: string): Promise<void> {
  dummyHashPromise ??= hashPassword(`unbekannt:${Math.random()}`);
  const dummy = await dummyHashPromise;
  await verifyPassword(dummy, plain);
}
