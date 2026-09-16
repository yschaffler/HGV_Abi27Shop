import 'server-only';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Alle oeffentlich sichtbaren Bezeichner stammen aus dem CSPRNG des Betriebssystems.
 * Nirgends Math.random(), nirgends fortlaufende IDs.
 */

/**
 * Crockford-Base32 ohne I, L, O und U: keine Verwechslung von 0/O und 1/I/L beim
 * Vorlesen an der Ausgabe, und kein zufaellig entstehendes Schimpfwort.
 */
const ORDER_NUMBER_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ORDER_NUMBER_LENGTH = 6;

/**
 * Menschenlesbare Referenz wie ABI-7F4K92.
 *
 * Wichtig: Diese Nummer ist KEIN Zugriffsschutz. Sie steht auf Listen, wird vorgelesen und
 * hat mit 6 Zeichen nur rund 30 Bit Entropie. Der Zugriff auf eine Bestellung laeuft
 * ausschliesslich ueber createPublicToken().
 */
export function createOrderNumber(prefix = 'ABI'): string {
  let suffix = '';
  for (let i = 0; i < ORDER_NUMBER_LENGTH; i += 1) {
    suffix += ORDER_NUMBER_ALPHABET[randomInt(0, ORDER_NUMBER_ALPHABET.length)];
  }
  return `${prefix}-${suffix}`;
}

/** 256 Bit Zufall, base64url – der alleinige Schluessel fuer /bestellung/<token>. */
export function createPublicToken(): string {
  return randomBytes(32).toString('base64url');
}

/** 256 Bit Zufall fuer das Session-Cookie. */
export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * In der Datenbank liegt nur dieser Hash. Wer die Datenbank liest, kann daraus kein
 * gueltiges Cookie bauen. SHA-256 genuegt hier, weil das Token bereits 256 Bit Entropie
 * hat – ein langsames Passwort-Hashverfahren braucht es nur bei ratbaren Geheimnissen.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Gut lesbare Notfallcodes im Format ABCD-EFGH-JKMN. */
export function createRecoveryCode(): string {
  const groups: string[] = [];
  for (let group = 0; group < 3; group += 1) {
    let part = '';
    for (let i = 0; i < 4; i += 1) {
      part += ORDER_NUMBER_ALPHABET[randomInt(0, ORDER_NUMBER_ALPHABET.length)];
    }
    groups.push(part);
  }
  return groups.join('-');
}

export function normalizeRecoveryCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Laufzeitkonstanter Vergleich – verhindert, dass Antwortzeiten ein Geheimnis verraten. */
export function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
