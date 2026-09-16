import 'server-only';
import { prisma } from '../db';
import { appUrl } from '../env';
import { logger } from '../logger';
import { getSettings } from '../settings';
import { escapeHtml } from '@/lib/escape-html';
import { formatCents } from '@/lib/money';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { sendMail } from './mailer';

/**
 * Bestellbestätigung nach erfolgreicher Zahlung.
 *
 * Wird ausschließlich aus dem Stripe-Webhook heraus aufgerufen, also erst dann, wenn die
 * Zahlung tatsächlich bestätigt ist. `confirmationEmailSentAt` verhindert, dass ein
 * erneut zugestellter Webhook eine zweite Mail auslöst.
 */

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Zahlung ausstehend',
  PAID: 'Bezahlt',
  FAILED: 'Zahlung fehlgeschlagen',
  REFUNDED: 'Erstattet',
  CANCELLED: 'Storniert',
};

export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: [{ productName: 'asc' }, { variantLabel: 'asc' }] } },
  });

  if (!order) {
    logger.warn('Bestätigungsmail: Bestellung nicht gefunden', { orderId });
    return;
  }

  if (order.confirmationEmailSentAt) return;

  // Schutz vor einer Mailflut, falls ein Webhook in einer Schleife hängt.
  const limit = checkRateLimit(`email:${order.email}`, RATE_LIMITS.email);
  if (!limit.allowed) {
    logger.warn('Bestätigungsmail wegen Rate Limit nicht versendet', { orderNumber: order.orderNumber });
    return;
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
    `Klasse: ${order.className}`,
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
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">
            <strong>${escapeHtml(item.productName)}</strong><br>
            <span style="color:#6b7280">${escapeHtml(item.variantLabel)}</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap">
            ${escapeHtml(formatCents(item.lineTotalCents))}
          </td>
        </tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="de">
  <body style="margin:0;padding:24px;background:#f5f5f7;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1f2937">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
      <h1 style="margin:0 0 4px;font-size:20px">Bestellung bestätigt</h1>
      <p style="margin:0 0 20px;color:#6b7280">${escapeHtml(settings.shopName)}</p>

      <p>Hallo ${escapeHtml(order.firstName)} ${escapeHtml(order.lastName)},</p>
      <p>vielen Dank für deine Bestellung. Wir haben deine Zahlung erhalten.</p>

      <table style="width:100%;border-collapse:collapse;margin:20px 0 4px">
        <tr>
          <td style="padding:4px 0;color:#6b7280">Bestellnummer</td>
          <td style="padding:4px 0;text-align:right"><strong>${escapeHtml(order.orderNumber)}</strong></td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280">Klasse</td>
          <td style="padding:4px 0;text-align:right">${escapeHtml(order.className)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280">Zahlungsstatus</td>
          <td style="padding:4px 0;text-align:right">${escapeHtml(statusLabel)}</td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="text-align:left;color:#6b7280;font-size:13px">
            <th style="padding:6px 0;border-bottom:1px solid #e5e7eb">Artikel</th>
            <th style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:center">Menge</th>
            <th style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right">Preis</th>
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
        <a href="${escapeHtml(orderUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:11px 18px;border-radius:8px;text-decoration:none">
          Bestellung ansehen
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">
        Diesen Link bitte nicht weitergeben – wer ihn hat, sieht deine Bestellung.
      </p>
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
    return;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { confirmationEmailSentAt: new Date() },
  });

  logger.info('Bestätigungsmail versendet', { orderNumber: order.orderNumber });
}
