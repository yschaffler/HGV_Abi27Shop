import { z } from 'zod';

/**
 * Rundmail an die Besteller.
 *
 * Der Text wird als Klartext versendet und fuer die HTML-Fassung escaped – es gibt hier
 * deshalb keine Einschraenkung auf bestimmte Zeichen, nur eine Laengengrenze.
 */
export const broadcastSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, 'Bitte einen Betreff angeben')
    .max(150, 'Hoechstens 150 Zeichen'),
  body: z
    .string()
    .trim()
    .min(10, 'Bitte einen Text schreiben')
    .max(5000, 'Hoechstens 5000 Zeichen'),
  audience: z.enum(['PAID', 'PAID_NOT_DISTRIBUTED'], { error: 'Bitte Empfaenger waehlen' }),
  /**
   * Muss "SENDEN" lauten. Eine Rundmail an den gesamten Jahrgang laesst sich nicht
   * zurueckholen – ein zweiter, bewusster Handgriff ist das mindeste.
   */
  confirm: z.literal('SENDEN', { error: 'Zum Absenden bitte SENDEN eintippen' }),
});

export type BroadcastInput = z.infer<typeof broadcastSchema>;
