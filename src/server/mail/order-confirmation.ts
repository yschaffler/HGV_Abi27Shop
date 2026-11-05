import 'server-only';
import { prisma } from '../db';
import { appUrl } from '../env';
import { logger } from '../logger';
import { getSettings } from '../settings';
import { escapeHtml } from '@/lib/escape-html';
import { formatCents } from '@/lib/money';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { MAIL_COLORS as C } from './branding';
import { sendMail } from './mailer';

/**
 * Bestellbestätigung nach erfolgreicher Zahlung.
 *
 * Geht nur für Bestellungen raus, die bereits auf PAID stehen – die Mail sagt "Zahlung
 * erhalten", und das muss stimmen. Ausgelöst wird sie automatisch, sobald eine Bestellung
 * bezahlt ist (Webhook oder Abgleich mit Stripe), und manuell aus dem Adminbereich.
 *
 * `confirmationEmailSentAt` verhindert, dass ein erneut zugestellter Webhook eine zweite
 * Mail auslöst. Nur ein ausdrückliches `resend` aus dem Adminbereich schickt sie nochmals.
 *
 * Das Ergebnis wird zurückgegeben statt nur geloggt: Der Adminbereich muss anzeigen können,
 * ob die Mail wirklich rausging.
 */

export type ConfirmationResult = 'sent' | 'already_sent' | 'not_paid' | 'not_found' | 'rate_limited' | 'failed';

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Zahlung ausstehend',
  PAID: 'Bezahlt',
  FAILED: 'Zahlung fehlgeschlagen',
  REFUNDED: 'Erstattet',
  CANCELLED: 'Storniert',
};

export async function sendOrderConfirmation(
  orderId: string,
  options: { resend?: boolean } = {},
): Promise<ConfirmationResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: [{ productName: 'asc' }, { variantLabel: 'asc' }] } },
  });

  if (!order) {
    logger.warn('Bestätigungsmail: Bestellung nicht gefunden', { orderId });
    return 'not_found';
  }

  if (order.paymentStatus !== 'PAID') return 'not_paid';
  if (order.confirmationEmailSentAt && !options.resend) return 'already_sent';

  // Schutz vor einer Mailflut, falls ein Webhook in einer Schleife hängt oder jemand im
  // Adminbereich zu oft klickt. Bewusst je Bestellung und nicht je Adresse: Wer mehrere
  // Bestellungen mit derselben Adresse aufgibt, bekommt sonst ab der sechsten keine
  // Bestätigung mehr – ohne dass es jemand merkt.
  const limit = checkRateLimit(`email:order:${order.id}`, RATE_LIMITS.email);
  if (!limit.allowed) {
    logger.warn('Bestätigungsmail wegen Rate Limit nicht versendet', { orderNumber: order.orderNumber });
    return 'rate_limited';
  }

  const settings = await getSettings();
  const orderUrl = appUrl(`/bestellung/${order.publicToken}`);
  const statusLabel = PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus;

  const textLines = [
    `Hallo ${order.firstName} ${order.lastName},`,
    '',
    'vielen Dank für deine Bestellung. Wir haben deine Zahlung erhalten.',
    '',
    `Bestellnummer: ${order.orderNumber}`,
    `Zahlungsstatus: ${statusLabel}`,
    '',
    'Deine Artikel:',
    ...order.items.map(
      (item) =>
        `  ${item.quantity} x ${item.productName} (${item.variantLabel}) — ` +
        `${formatCents(item.unitPriceCents)} je Stück, ${formatCents(item.lineTotalCents)} gesamt`,
    ),
    '',
    `Gesamtbetrag: ${formatCents(order.totalCents)}`,
    '',
    'Abholung:',
    settings.pickupInfo,
    '',
    'Deine Bestellung kannst du jederzeit hier ansehen:',
    orderUrl,
    '',
    'Diesen Link bitte nicht weitergeben – wer ihn hat, sieht deine Bestellung.',
    '',
    settings.shopName,
  ];

  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${C.line}">
            <strong>${escapeHtml(item.productName)}</strong><br>
            <span style="color:${C.textMuted}">${escapeHtml(item.variantLabel)}</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid ${C.line};text-align:center">${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap">
            ${escapeHtml(formatCents(item.lineTotalCents))}
          </td>
        </tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="de">
  <body style="margin:0;padding:24px;background:${C.page};font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:${C.text}">
    <div style="max-width:560px;margin:0 auto;background:${C.card};border-radius:12px;overflow:hidden;border:1px solid ${C.line}">
      <div style="background:${C.navy};padding:20px 28px;border-bottom:1px solid ${C.navyLine}">
        <p style="margin:0;color:${C.creme};font-size:13px;letter-spacing:0.18em;text-transform:uppercase">
          ${escapeHtml(settings.shopName)}
        </p>
      </div>
      <div style="padding:28px">
      <h1 style="margin:0 0 20px;font-size:20px;color:${C.text}">Bestellung bestätigt</h1>

      <p>Hallo ${escapeHtml(order.firstName)} ${escapeHtml(order.lastName)},</p>
      <p>vielen Dank für deine Bestellung. Wir haben deine Zahlung erhalten.</p>

      <table style="width:100%;border-collapse:collapse;margin:20px 0 4px">
        <tr>
          <td style="padding:4px 0;color:${C.textMuted}">Bestellnummer</td>
          <td style="padding:4px 0;text-align:right"><strong>${escapeHtml(order.orderNumber)}</strong></td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:${C.textMuted}">Zahlungsstatus</td>
          <td style="padding:4px 0;text-align:right">${escapeHtml(statusLabel)}</td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="text-align:left;color:${C.textMuted};font-size:13px">
            <th style="padding:6px 0;border-bottom:1px solid ${C.line}">Artikel</th>
            <th style="padding:6px 0;border-bottom:1px solid ${C.line};text-align:center">Menge</th>
            <th style="padding:6px 0;border-bottom:1px solid ${C.line};text-align:right">Preis</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr>
            <td style="padding:12px 0"><strong>Gesamt</strong></td>
            <td></td>
            <td style="padding:12px 0;text-align:right"><strong>${escapeHtml(formatCents(order.totalCents))}</strong></td>
          </tr>
        </tfoot>
      </table>

      <h2 style="font-size:16px;margin:24px 0 8px">Abholung</h2>
      <p style="white-space:pre-line;margin:0 0 20px">${escapeHtml(settings.pickupInfo)}</p>

      <p style="margin:0 0 8px">
        <a href="${escapeHtml(orderUrl)}" style="display:inline-block;background:${C.navy};color:${C.creme};padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
          Bestellung ansehen
        </a>
      </p>
      <p style="color:${C.textMuted};font-size:13px">
        Diesen Link bitte nicht weitergeben – wer ihn hat, sieht deine Bestellung.
      </p>
      </div>
    </div>
  </body>
</html>`;

  const result = await sendMail({
    to: order.email,
    subject: `Bestellbestätigung ${order.orderNumber} – ${settings.shopName}`,
    text: textLines.join('\n'),
    html,
  });

  if (!result.ok) {
    logger.error('Bestätigungsmail konnte nicht versendet werden', {
      orderNumber: order.orderNumber,
      reason: result.error,
    });
    return 'failed';
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { confirmationEmailSentAt: new Date() },
  });

  logger.info('Bestätigungsmail versendet', { orderNumber: order.orderNumber, resend: Boolean(options.resend) });
  return 'sent';
}

/**
 * Schickt allen bezahlten Bestellungen, die noch keine Bestätigung bekommen haben, die
 * Mail nach. Für den Adminbereich, etwa nach einem Ausfall des Mailversands.
 */
export async function sendMissingConfirmations(): Promise<{ pending: number; sent: number; failed: number }> {
  const missing = await prisma.order.findMany({
    where: { paymentStatus: 'PAID', confirmationEmailSentAt: null },
    select: { id: true },
    orderBy: { paidAt: 'asc' },
    take: 500,
  });

  let sent = 0;
  let failed = 0;
  for (const order of missing) {
    try {
      const result = await sendOrderConfirmation(order.id);
      if (result === 'sent') sent += 1;
      else if (result !== 'already_sent') failed += 1;
    } catch (error) {
      failed += 1;
      logger.error('Nachsenden der Bestätigungsmail fehlgeschlagen', { orderId: order.id, error });
    }
  }

  return { pending: missing.length, sent, failed };
}
