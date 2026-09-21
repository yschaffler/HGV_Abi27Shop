import { z } from 'zod';

/**
 * Grenzen für eine Bestellung. Sie sind bewusst eng: ein Abi-Jahrgang bestellt ein paar
 * Pullis, keine Paletten. Die Werte begrenzen Mengenmanipulation und halten die
 * Sammelbestellung plausibel.
 */
export const ORDER_LIMITS = {
  maxQuantityPerLine: 10,
  maxLines: 20,
  maxTotalQuantity: 50,
} as const;

/**
 * Namen: Buchstaben inklusive Umlauten und diakritischer Zeichen, Leerzeichen, Bindestrich,
 * Apostroph. Keine Steuerzeichen, keine Ziffern, kein <, >, & – damit landet nichts
 * Ueberraschendes in Mails oder Exporten.
 */
const nameSchema = z
  .string()
  .trim()
  .min(1, 'Bitte ausfüllen')
  .max(80, 'Zu lang')
  .regex(/^[\p{L}][\p{L}\p{M}\s'’-]*$/u, 'Bitte nur Buchstaben, Leerzeichen und Bindestriche');

/** Klassenbezeichnung wie "13B", "Q2" oder "12/3". */
const classNameSchema = z
  .string()
  .trim()
  .min(1, 'Bitte ausfüllen')
  .max(20, 'Zu lang')
  .regex(/^[\p{L}\p{N}][\p{L}\p{N}\s/.-]*$/u, 'Ungültige Klassenbezeichnung');

const emailSchema = z
  .email('Bitte eine gültige E-Mail-Adresse angeben')
  .trim()
  .max(180, 'Zu lang')
  .transform((value) => value.toLowerCase());

/** Der Client schickt ausschließlich Varianten-ID und Menge – niemals einen Preis. */
export const cartLineSchema = z.object({
  variantId: z.string().trim().min(1).max(64),
  quantity: z
    .number({ error: 'Ungültige Menge' })
    .int('Ungültige Menge')
    .min(1, 'Mindestens 1')
    .max(ORDER_LIMITS.maxQuantityPerLine, `Maximal ${ORDER_LIMITS.maxQuantityPerLine} pro Artikel`),
});

export const cartSchema = z
  .array(cartLineSchema)
  .min(1, 'Der Warenkorb ist leer')
  .max(ORDER_LIMITS.maxLines, 'Zu viele verschiedene Artikel');

export const customerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  className: classNameSchema,
});

export const checkoutSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  className: classNameSchema,
  items: cartSchema,
  /** Muss aktiv bestätigt werden; der Wert wird serverseitig geprüft, nicht nur im Browser. */
  acceptedTerms: z.literal(true, { error: 'Bitte bestätigen' }),
  /**
   * Bestätigung, dass es keinen Versand gibt und der Hoodie in der Schule bei den
   * Q-Sprechern abgeholt wird. Steht absichtlich getrennt von acceptedTerms: Es ist der
   * Punkt, an dem hinterher die meisten Rückfragen entstehen, und ein eigenes Häkchen
   * lässt sich später auch einzeln nachweisen.
   */
  acceptedPickup: z.literal(true, { error: 'Bitte bestätigen' }),
});

export type CartLineInput = z.infer<typeof cartLineSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;

/** 43 Zeichen base64url – siehe server/crypto/tokens.ts. */
export const publicTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{20,64}$/, 'Ungültige Bestellreferenz');
