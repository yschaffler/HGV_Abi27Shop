import { z } from 'zod';

/**
 * Zugangscode fuer den Shop.
 *
 * Grosszuegig beim Format, weil der Code abgetippt wird: Leerzeichen und Gross-/
 * Kleinschreibung gleicht server/shop/access.ts aus. Die Laengengrenze verhindert nur,
 * dass jemand Megabytes in die Argon2-Pruefung schiebt.
 */
export const accessCodeSchema = z
  .string({ error: 'Bitte den Code eingeben' })
  .trim()
  .min(1, 'Bitte den Code eingeben')
  .max(64, 'Der Code ist zu lang');

/** Beim Setzen im Adminbereich gelten zusaetzlich ein Mindestmass und ein festes Alphabet. */
export const newAccessCodeSchema = z
  .string()
  .trim()
  .min(4, 'Mindestens 4 Zeichen')
  .max(64, 'Hoechstens 64 Zeichen')
  .regex(/^[\p{L}\p{N} _-]+$/u, 'Nur Buchstaben, Ziffern, Leerzeichen, Bindestrich und Unterstrich');

/** Freitexthinweis auf der Zugangsseite, z. B. wo der Code zu finden ist. */
export const accessHintSchema = z.string().trim().max(200, 'Hoechstens 200 Zeichen');
