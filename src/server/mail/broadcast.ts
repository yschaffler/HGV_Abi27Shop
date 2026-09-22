import 'server-only';
import { prisma } from '../db';
import { appUrl } from '../env';
import { logger } from '../logger';
import { getSettings } from '../settings';
import { sendMail } from './mailer';
import { escapeHtml } from '@/lib/escape-html';
import type { BroadcastAudience } from '@/generated/prisma/enums';

/**
 * Rundmail an die Besteller – etwa die Ankuendigung des Ausgabetermins.
 *
 * Aufbau bewusst schlicht: Ein Freitext des Admins, ein Gruss mit dem Vornamen, die
 * Bestellnummer und der persoenliche Link. Kein Editor, kein HTML aus dem Formular. Der
 * Freitext wird fuer die HTML-Fassung escaped und nur an Zeilenumbruechen aufgeteilt; es
 * gibt keinen Weg, ueber das Adminformular Markup in eine Mail zu bekommen.
 *
 * Zustellung wird je Empfaenger protokolliert (BroadcastDelivery mit Unique-Constraint auf
 * Rundmail + Bestellung). Ein zweiter Anlauf schreibt deshalb nur die an, bei denen noch
 * nichts angekommen ist – bei 160 Leuten ist "nochmal an alle" keine akzeptable Loesung.
 */

/** Pause zwischen zwei Mails. Schont Mailserver und Ratengrenzen der Anbieter. */
const SEND_DELAY_MS = 150;

function audienceWhere(audience: BroadcastAudience) {
  // Unbezahlte Bestellungen bekommen nie eine Abholmail – es gibt nichts abzuholen.
  return audience === 'PAID'
    ? { paymentStatus: 'PAID' as const }
    : { paymentStatus: 'PAID' as const, distributionStatus: { not: 'FULLY_DISTRIBUTED' as const } };
}

export async function countRecipients(audience: BroadcastAudience): Promise<number> {
  return prisma.order.count({ where: audienceWhere(audience) });
}

export type BroadcastPreview = {
  subject: string;
  text: string;
};

/** Baut die Mail so auf, wie sie ein Besteller bekommt – fuer die Vorschau im Adminbereich. */
export async function renderBroadcastPreview(params: {
  subject: string;
  body: string;
}): Promise<BroadcastPreview> {
  const settings = await getSettings();

  return {
    subject: params.subject,
    text: buildText({
      firstName: 'Max',
      orderNumber: 'ABI-BEISPIEL',
      orderUrl: appUrl('/bestellung/…'),
      body: params.body,
      shopName: settings.shopName,
    }),
  };
}

function buildText(params: {
  firstName: string;
  orderNumber: string;
  orderUrl: string;
  body: string;
  shopName: string;
}): string {
  return [
    `Hallo ${params.firstName},`,
    '',
    params.body.trim(),
    '',
    `Deine Bestellnummer: ${params.orderNumber}`,
    `Deine Bestellung: ${params.orderUrl}`,
    '',
    params.shopName,
  ].join('\n');
}

function buildHtml(params: {
  firstName: string;
  orderNumber: string;
  orderUrl: string;
  body: string;
  shopName: string;
}): string {
  // Absatzweise escapen und mit <p> umschliessen: Umbrueche bleiben erhalten, Markup nicht.
  const paragraphs = params.body
    .trim()
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 12px">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');

  return `<!doctype html>
<html lang="de">
  <body style="margin:0;background:#f6f4ee;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f2420">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <p style="margin:0 0 20px;color:#6b7280">${escapeHtml(params.shopName)}</p>

      <p>Hallo ${escapeHtml(params.firstName)},</p>
      ${paragraphs}

      <table style="width:100%;border-collapse:collapse;margin:20px 0 4px">
        <tr>
          <td style="padding:4px 0;color:#6b7280">Bestellnummer</td>
          <td style="padding:4px 0;text-align:right"><strong>${escapeHtml(params.orderNumber)}</strong></td>
        </tr>
      </table>

      <p style="margin:20px 0">
        <a href="${escapeHtml(params.orderUrl)}" style="color:#4b5320">Deine Bestellung ansehen</a>
      </p>

      <p style="margin:24px 0 0;font-size:12px;color:#6b7280">
        Diesen Link bitte nicht weitergeben – wer ihn hat, sieht deine Bestellung.
      </p>
    </div>
  </body>
</html>`;
}

export type BroadcastRunResult = {
  sent: number;
  failed: number;
  skipped: number;
};

/**
 * Versendet eine Rundmail.
 *
 * Laeuft bewusst als eigener Schritt nach dem Anlegen des Datensatzes: Wenn der Prozess
 * mitten im Versand neu startet, steht in der Datenbank trotzdem, wer schon erreicht wurde,
 * und ein erneuter Aufruf macht dort weiter.
 */
export async function runBroadcast(broadcastId: string): Promise<BroadcastRunResult> {
  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) return { sent: 0, failed: 0, skipped: 0 };

  const settings = await getSettings();

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: 'SENDING', startedAt: broadcast.startedAt ?? new Date() },
  });

  const recipients = await prisma.order.findMany({
    where: {
      ...audienceWhere(broadcast.audience),
      // Wer diese Rundmail schon bekommen hat, wird uebersprungen.
      deliveries: { none: { broadcastId, error: null } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: { id: true, firstName: true, email: true, orderNumber: true, publicToken: true },
  });

  let sent = 0;
  let failed = 0;

  for (const order of recipients) {
    const content = {
      firstName: order.firstName,
      orderNumber: order.orderNumber,
      orderUrl: appUrl(`/bestellung/${order.publicToken}`),
      body: broadcast.body,
      shopName: settings.shopName,
    };

    const result = await sendMail({
      to: order.email,
      subject: broadcast.subject,
      text: buildText(content),
      html: buildHtml(content),
    });

    if (result.ok) sent += 1;
    else failed += 1;

    // Auch der Fehlschlag wird festgehalten: Beim naechsten Anlauf wird dieser Eintrag
    // ueberschrieben, weil nur Zeilen ohne Fehler als "erledigt" zaehlen.
    await prisma.broadcastDelivery.upsert({
      where: { broadcastId_orderId: { broadcastId, orderId: order.id } },
      create: {
        broadcastId,
        orderId: order.id,
        error: result.ok ? null : result.error.slice(0, 500),
      },
      update: {
        sentAt: new Date(),
        error: result.ok ? null : result.error.slice(0, 500),
      },
    });

    if (SEND_DELAY_MS > 0) await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
  }

  const [deliveredTotal, failedTotal] = await Promise.all([
    prisma.broadcastDelivery.count({ where: { broadcastId, error: null } }),
    prisma.broadcastDelivery.count({ where: { broadcastId, error: { not: null } } }),
  ]);

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: {
      status: failedTotal > 0 ? 'FAILED' : 'SENT',
      sentCount: deliveredTotal,
      failedCount: failedTotal,
      finishedAt: new Date(),
      lastError: failedTotal > 0 ? `${failedTotal} Mail(s) konnten nicht zugestellt werden.` : null,
    },
  });

  logger.info('Rundmail versendet', {
    broadcastId,
    sent,
    failed,
    recipients: recipients.length,
  });

  return { sent, failed, skipped: 0 };
}
