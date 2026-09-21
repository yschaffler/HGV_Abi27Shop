import 'server-only';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { hashPassword, verifyPassword } from '../auth/password';
import { env } from '../env';
import { getSettings } from '../settings';

/**
 * Zugangscode fuer den Shop.
 *
 * Der Shop richtet sich an einen Jahrgang, nicht an die Allgemeinheit. Der Code (z. B.
 * "ABI27") wird im Abichat verteilt und haelt Fremde draussen, die zufaellig auf der
 * Domain landen.
 *
 * Was das ist und was nicht:
 *   - Es ist eine Tuer, kein Tresor. Ein von 160 Leuten geteilter Code ist kein Geheimnis;
 *     er verhindert das beilaeufige Mitlesen und das Bestellen durch Unbeteiligte.
 *   - Er schuetzt KEINE personenbezogenen Daten. Wer eine fremde Bestellung sehen will,
 *     braucht weiterhin deren 256-Bit-Token - daran aendert der Code nichts.
 *
 * Gespeichert wird nur ein Argon2id-Hash. Der Code selbst steht nirgends in der Datenbank
 * und laesst sich auch im Adminbereich nicht auslesen, sondern nur neu setzen. Das kostet
 * etwas Komfort und ist es wert: Ein Datenbankabzug gibt den Code nicht preis.
 *
 * Das Cookie ist HMAC-signiert (AUTH_SECRET) und enthaelt ausser dem Ablaufzeitpunkt eine
 * kurze Ableitung des aktuellen Code-Hashes. Wer den Code aendert, sperrt damit alle
 * bestehenden Cookies aus - genau das erwartet man, wenn ein Code "verbrannt" ist.
 */

export const ACCESS_COOKIE = 'abishop_access';

/** 30 Tage: lange genug, dass niemand den Code staendig neu eintippt. */
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const COOKIE_VERSION = 'v1';

function signingKey(): Buffer {
  return Buffer.from(env().AUTH_SECRET, 'utf8');
}

/**
 * Kurze, nicht umkehrbare Ableitung des Code-Hashes.
 *
 * Landet im Cookie, damit ein Codewechsel alte Cookies ungueltig macht. Aus ihr laesst
 * sich weder der Code noch der Argon2-Hash zurueckrechnen.
 */
function codeGeneration(accessCodeHash: string): string {
  return createHash('sha256').update(accessCodeHash, 'utf8').digest('base64url').slice(0, 16);
}

function sign(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload, 'utf8').digest('base64url');
}

function equalsConstantTime(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Cookie-Wert: v1.<generation>.<ablauf in Sekunden>.<signatur> */
export function createAccessCookieValue(accessCodeHash: string, now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + MAX_AGE_SECONDS;
  const payload = `${COOKIE_VERSION}.${codeGeneration(accessCodeHash)}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function isAccessCookieValid(
  value: string | undefined,
  accessCodeHash: string,
  now = Date.now(),
): boolean {
  if (!value) return false;

  const parts = value.split('.');
  if (parts.length !== 4) return false;

  const [version, generation, expiresAtRaw, signature] = parts as [string, string, string, string];
  if (version !== COOKIE_VERSION) return false;

  // Erst die Signatur, dann der Inhalt: Ungepruefte Daten werden nicht ausgewertet.
  const payload = `${version}.${generation}.${expiresAtRaw}`;
  if (!equalsConstantTime(signature, sign(payload))) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt * 1000 <= now) return false;

  return equalsConstantTime(generation, codeGeneration(accessCodeHash));
}

export type AccessState =
  | { required: false }
  | { required: true; unlocked: boolean; hint: string | null };

/** Liest den aktuellen Zustand: Ist ein Code gesetzt, und hat dieser Browser ihn schon? */
export async function readAccessState(): Promise<AccessState> {
  const settings = await getSettings();
  const codeHash = settings.accessCodeHash;

  if (!codeHash) return { required: false };

  const store = await cookies();
  const cookie = store.get(ACCESS_COOKIE)?.value;

  return {
    required: true,
    unlocked: isAccessCookieValid(cookie, codeHash),
    hint: settings.accessHint,
  };
}

/**
 * Prueft den eingegebenen Code und setzt bei Erfolg das Cookie.
 *
 * Gibt bewusst nur "passt" oder "passt nicht" zurueck - kein Hinweis darauf, ob ueberhaupt
 * ein Code gesetzt ist oder wie lang er sein muesste.
 */
export async function unlockWithCode(code: string): Promise<boolean> {
  const settings = await getSettings();
  const codeHash = settings.accessCodeHash;
  if (!codeHash) return true;

  const ok = await verifyPassword(codeHash, normalizeCode(code));
  if (!ok) return false;

  const store = await cookies();
  store.set(ACCESS_COOKIE, createAccessCookieValue(codeHash), {
    httpOnly: true,
    secure: env().NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });

  return true;
}

/**
 * Gross-/Kleinschreibung und Leerzeichen sollen nicht entscheiden.
 *
 * Ein Code, der im Chat steht und abgetippt wird, kommt mal als "abi27", mal als "ABI 27"
 * an. Die Normalisierung passiert an genau einer Stelle und gilt fuer das Setzen wie fuer
 * das Pruefen - sonst passt ein gerade gesetzter Code nicht zu sich selbst.
 */
export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase();
}

/** Setzt einen neuen Code. Gibt den Hash zurueck, der Klartext wird nicht behalten. */
export async function hashAccessCode(code: string): Promise<string> {
  return hashPassword(normalizeCode(code));
}
