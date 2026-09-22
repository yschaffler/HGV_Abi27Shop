import { z } from 'zod';

/**
 * Eingaben des Adminbereichs. Auch Admins sind nicht vertrauenswürdig im technischen Sinne:
 * Ein XSS an anderer Stelle oder ein übernommenes Konto darf nicht dazu führen, dass
 * beliebige Werte in die Datenbank geschrieben werden.
 */

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'] as const;
export const FULFILLMENT_STATUSES = ['NEW', 'ORDERED', 'ARRIVED'] as const;
export const ORDER_DISTRIBUTION_STATUSES = ['NOT_DISTRIBUTED', 'PARTIALLY_DISTRIBUTED', 'FULLY_DISTRIBUTED'] as const;

export const orderFilterSchema = z.object({
  suche: z.string().trim().max(80).optional(),
  zahlung: z.enum(PAYMENT_STATUSES).optional(),
  sammelbestellung: z.enum(FULFILLMENT_STATUSES).optional(),
  ausgabe: z.enum(ORDER_DISTRIBUTION_STATUSES).optional(),
  seite: z.coerce.number().int().min(1).max(1000).default(1),
});

export type OrderFilter = z.infer<typeof orderFilterSchema>;

/** Slugs bleiben auf Kleinbuchstaben, Ziffern und Bindestriche beschränkt – sie landen in URLs. */
export const slugSchema = z
  .string()
  .trim()
  .min(2, 'Mindestens 2 Zeichen')
  .max(60, 'Höchstens 60 Zeichen')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Nur Kleinbuchstaben, Ziffern und Bindestriche');

export const productSchema = z.object({
  id: z.string().trim().max(64).optional(),
  slug: slugSchema,
  name: z.string().trim().min(2, 'Mindestens 2 Zeichen').max(120),
  summary: z.string().trim().max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  imageId: z.string().trim().max(64).optional(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export const variantSchema = z.object({
  id: z.string().trim().max(64).optional(),
  productId: z.string().trim().min(1).max(64),
  color: z.string().trim().max(40),
  size: z.string().trim().max(20),
  label: z.string().trim().max(60),
  /** Preise kommen als "39,90" aus dem Formular und werden zu Cent normalisiert. */
  price: z.string().trim().min(1, 'Preis fehlt').max(12),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

const dateTimeLocalSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Ungültiges Datum')
  .optional()
  .or(z.literal(''));

export const settingsSchema = z.object({
  shopName: z.string().trim().min(2).max(80),
  contactEmail: z.union([z.email(), z.literal('')]).transform((value) => value.trim().toLowerCase()),
  orderStartAt: dateTimeLocalSchema,
  orderEndAt: dateTimeLocalSchema,
  closedNotice: z.string().trim().max(1000),
  pickupInfo: z.string().trim().max(2000),
  imprintText: z.string().trim().max(20000),
  privacyText: z.string().trim().max(20000),
  withdrawalText: z.string().trim().max(20000),
  termsText: z.string().trim().max(20000),
});

export const userSchema = z.object({
  email: z.email('Ungültige E-Mail-Adresse').max(180).transform((value) => value.toLowerCase()),
  name: z.string().trim().min(2, 'Mindestens 2 Zeichen').max(80),
  role: z.enum(['ADMIN', 'DISTRIBUTION']),
});

export const idSchema = z.string().trim().min(1).max(64);
