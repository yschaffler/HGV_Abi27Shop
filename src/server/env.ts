import 'server-only';
import { z } from 'zod';

/**
 * Zentrale, einmalig validierte Konfiguration.
 *
 * Bewusst *lazy*: `next build` läuft im Docker-Image ohne Produktions-Secrets. Erst der
 * erste tatsächliche Zugriff zur Laufzeit validiert. Damit scheitert ein falsch
 * konfigurierter Container sofort beim Start (durch den Healthcheck), nicht erst bei der
 * ersten Bestellung – ohne dass der Build Secrets braucht.
 */

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL fehlt'),

  /** Basis für Session-Cookies und die Verschlüsselung der TOTP-Secrets. */
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET muss mindestens 32 Zeichen haben'),

  /** Oeffentliche Basis-URL, z. B. https://abishop.example.de – ohne abschließenden Slash. */
  APP_URL: z.url('APP_URL muss eine vollständige URL sein'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /**
   * Leer lassen = Stripe entscheidet anhand der Dashboard-Einstellungen, welche
   * Zahlungsarten (Karte, PayPal, ...) für das Konto und Land angeboten werden.
   */
  STRIPE_PAYMENT_METHOD_TYPES: z.string().optional(),

  EMAIL_DRIVER: z.enum(['console', 'resend', 'smtp']).default('console'),
  EMAIL_FROM: z.string().optional(),
  EMAIL_REPLY_TO: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: booleanish.optional(),

  /** Ablageort für Produktbilder. Im Container ein persistentes Volume. */
  UPLOAD_DIR: z.string().default('./data/uploads'),

  /**
   * Nur aktivieren, wenn die App tatsächlich hinter einem Reverse Proxy läuft, dem man
   * vertraut. Sonst könnte jeder Client sein Rate Limit per X-Forwarded-For umgehen.
   */
  TRUST_PROXY_HEADERS: booleanish.default(false),

  SESSION_MAX_AGE_HOURS: z.coerce.number().int().min(1).max(720).default(12),
});

const schema = baseSchema.superRefine((value, ctx) => {
  if (value.NODE_ENV !== 'production') return;

  const requiredInProduction: Array<[keyof typeof value, string]> = [
    ['STRIPE_SECRET_KEY', 'STRIPE_SECRET_KEY wird im Produktionsbetrieb benötigt'],
    ['STRIPE_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET wird im Produktionsbetrieb benötigt'],
  ];

  for (const [key, message] of requiredInProduction) {
    if (!value[key]) ctx.addIssue({ code: 'custom', message, path: [key] });
  }

  if (value.EMAIL_DRIVER === 'console') {
    ctx.addIssue({
      code: 'custom',
      message: 'EMAIL_DRIVER "console" verschickt keine echten Mails und ist in Produktion unzulässig',
      path: ['EMAIL_DRIVER'],
    });
  }
  if (value.EMAIL_DRIVER === 'resend' && !value.RESEND_API_KEY) {
    ctx.addIssue({ code: 'custom', message: 'RESEND_API_KEY fehlt', path: ['RESEND_API_KEY'] });
  }
  if (value.EMAIL_DRIVER === 'smtp' && !value.SMTP_HOST) {
    ctx.addIssue({ code: 'custom', message: 'SMTP_HOST fehlt', path: ['SMTP_HOST'] });
  }
  if (value.EMAIL_DRIVER !== 'console' && !value.EMAIL_FROM) {
    ctx.addIssue({ code: 'custom', message: 'EMAIL_FROM fehlt', path: ['EMAIL_FROM'] });
  }
  if (!value.APP_URL.startsWith('https://')) {
    ctx.addIssue({
      code: 'custom',
      message: 'APP_URL muss in Produktion mit https:// beginnen',
      path: ['APP_URL'],
    });
  }
});

export type Env = z.infer<typeof baseSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Nur die Namen der betroffenen Variablen ausgeben – niemals deren Werte.
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n  ');
    throw new Error(`Konfiguration unvollständig oder ungültig:\n  ${problems}`);
  }

  cached = parsed.data;
  return cached;
}

/** Nur für Tests: erzwingt eine erneute Validierung. */
export function resetEnvCache(): void {
  cached = null;
}

export function isProduction(): boolean {
  return env().NODE_ENV === 'production';
}

/** Basis-URL ohne abschließenden Slash, damit Pfade sauber angehaengt werden können. */
export function appUrl(path = ''): string {
  const base = env().APP_URL.replace(/\/+$/, '');
  if (!path) return base;
  return `${base}/${path.replace(/^\/+/, '')}`;
}
