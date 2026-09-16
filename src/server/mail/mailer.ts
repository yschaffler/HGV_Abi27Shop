import 'server-only';
import { env } from '../env';
import { logger } from '../logger';

/**
 * Mailversand mit austauschbarem Treiber.
 *
 * - console: schreibt die Mail ins Serverlog (nur Entwicklung, in Produktion abgelehnt)
 * - resend:  HTTP-API, ohne zusätzliches SDK
 * - smtp:    klassischer Mailserver über nodemailer, z. B. der Server der Schule
 *
 * Der Aufrufer bekommt ein Ergebnisobjekt statt einer Exception: ein fehlgeschlagener
 * Mailversand darf niemals eine bereits erfolgte Zahlung zurückrollen.
 */

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type MailResult = { ok: true } | { ok: false; error: string };

async function sendViaResend(message: MailMessage): Promise<MailResult> {
  const apiKey = env().RESEND_API_KEY;
  const from = env().EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, error: 'Resend ist nicht vollständig konfiguriert' };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(env().EMAIL_REPLY_TO ? { reply_to: env().EMAIL_REPLY_TO } : {}),
    }),
  });

  if (!response.ok) {
    // Der Antworttext kann Kontodetails enthalten – nur den Statuscode weitergeben.
    return { ok: false, error: `Resend antwortete mit Status ${response.status}` };
  }

  return { ok: true };
}

async function sendViaSmtp(message: MailMessage): Promise<MailResult> {
  const config = env();
  if (!config.SMTP_HOST || !config.EMAIL_FROM) {
    return { ok: false, error: 'SMTP ist nicht vollständig konfiguriert' };
  }

  // Nur laden, wenn SMTP tatsächlich benutzt wird.
  const { createTransport } = await import('nodemailer');

  const transport = createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT ?? 587,
    secure: config.SMTP_SECURE ?? false,
    ...(config.SMTP_USER && config.SMTP_PASSWORD
      ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } }
      : {}),
    // STARTTLS erzwingen, wenn nicht ohnehin implizit verschlüsselt wird.
    requireTLS: !(config.SMTP_SECURE ?? false),
  });

  await transport.sendMail({
    from: config.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    ...(config.EMAIL_REPLY_TO ? { replyTo: config.EMAIL_REPLY_TO } : {}),
  });

  return { ok: true };
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const driver = env().EMAIL_DRIVER;

  try {
    switch (driver) {
      case 'resend':
        return await sendViaResend(message);
      case 'smtp':
        return await sendViaSmtp(message);
      case 'console':
        logger.info('E-Mail (Treiber console, kein echter Versand)', {
          to: message.to,
          subject: message.subject,
        });
        process.stdout.write(`\n--- E-Mail an ${message.to} ---\n${message.text}\n--- Ende ---\n\n`);
        return { ok: true };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler beim Mailversand',
    };
  }
}
