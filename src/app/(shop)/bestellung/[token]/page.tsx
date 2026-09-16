import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DistributionStatusBadge, PaymentStatusBadge } from '@/components/shop/order-status-badge';
import { OrderPageEffects } from '@/components/shop/order-page-effects';
import { formatCents } from '@/lib/money';
import { publicTokenSchema } from '@/lib/validation/order';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { clientIp } from '@/server/request-context';
import { findOrderByPublicToken } from '@/server/shop/order';
import { getSettings } from '@/server/settings';

/**
 * Bestellstatus für den Besteller.
 *
 * Der Token in der URL ist das einzige Zugangsmerkmal – 256 Bit Zufall, nicht erratbar und
 * nicht hochzählbar. Es gibt bewusst keinen Zugriff über die Bestellnummer: die steht auf
 * Listen und wird vorgelesen, sie taugt nicht als Geheimnis.
 *
 * Die Seite setzt NIEMALS einen Zahlungsstatus. Sie zeigt nur an, was der signaturgeprüfte
 * Stripe-Webhook in der Datenbank hinterlegt hat.
 */

export const metadata: Metadata = { title: 'Deine Bestellung', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrderPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;

  const parsedToken = publicTokenSchema.safeParse(token);
  if (!parsedToken.success) notFound();

  // Bremst das Durchprobieren von Tokens zusätzlich ab – rechnerisch aussichtslos ist es ohnehin.
  const ip = await clientIp();
  const limit = checkRateLimit(`order-lookup:${ip}`, RATE_LIMITS.orderLookup);
  if (!limit.allowed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl">Zu viele Anfragen</h1>
        <p className="text-muted mt-2">Bitte versuche es in ein paar Minuten noch einmal.</p>
      </div>
    );
  }

  const [order, settings] = await Promise.all([findOrderByPublicToken(parsedToken.data), getSettings()]);
  if (!order) notFound();

  const cameFromPayment = query['zahlung'] === 'erfolgreich';
  const awaitingPayment = order.paymentStatus === 'PENDING' && cameFromPayment;
  const cancelled = query['zahlung'] === 'abgebrochen';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <OrderPageEffects paid={order.paymentStatus === 'PAID'} awaitingPayment={awaitingPayment} />

      {awaitingPayment ? (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">Zahlung wird bestätigt …</p>
          <p className="mt-1">
            Das dauert normalerweise nur wenige Sekunden. Die Seite aktualisiert sich automatisch.
            Der Status wird ausschließlich von unserem Zahlungsdienstleister bestätigt.
          </p>
        </div>
      ) : null}

      {cancelled && order.paymentStatus === 'PENDING' ? (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">Zahlung abgebrochen</p>
          <p className="mt-1">
            Die Bestellung ist gespeichert, aber noch nicht bezahlt. Bitte lege sie neu an, wenn du sie
            doch möchtest.
          </p>
        </div>
      ) : null}

      {order.paymentStatus === 'PAID' ? (
        <div className="mb-6 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-100">
          <p className="font-semibold">Zahlung eingegangen – vielen Dank!</p>
          <p className="mt-1">Eine Bestellbestätigung ist an {order.email} unterwegs.</p>
        </div>
      ) : null}

      <header className="mb-6">
        <p className="text-muted text-sm">Bestellnummer</p>
        <h1 className="font-mono text-2xl tracking-wide sm:text-3xl">{order.orderNumber}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <PaymentStatusBadge status={order.paymentStatus} />
          {order.paymentStatus === 'PAID' ? <DistributionStatusBadge status={order.distributionStatus} /> : null}
        </div>
      </header>

      <section className="surface-card rounded-2xl p-5">
        <h2 className="text-lg">Bestelldaten</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Name</dt>
            <dd className="text-strong">{order.firstName} {order.lastName}</dd>
          </div>
          <div>
            <dt className="text-muted">Klasse</dt>
            <dd className="text-strong">{order.className}</dd>
          </div>
          <div>
            <dt className="text-muted">E-Mail</dt>
            <dd className="text-strong break-all">{order.email}</dd>
          </div>
          <div>
            <dt className="text-muted">Bestellt am</dt>
            <dd className="text-strong">
              {new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(order.createdAt)} Uhr
            </dd>
          </div>
        </dl>
      </section>

      <section className="surface-card mt-4 rounded-2xl p-5">
        <h2 className="text-lg">Artikel</h2>
        <ul className="mt-3 space-y-3">
          {order.items.map((item) => (
            <li key={item.id} className="border-line flex flex-wrap justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
              <div>
                <p className="text-strong font-medium">
                  {item.quantity} × {item.productName}
                </p>
                <p className="text-muted text-sm">{item.variantLabel}</p>
                {item.distributionStatus === 'DISTRIBUTED' ? (
                  <p className="mt-1 text-xs font-semibold text-green-700 dark:text-green-400">Ausgegeben</p>
                ) : null}
              </div>
              <p className="text-strong font-semibold">{formatCents(item.lineTotalCents)}</p>
            </li>
          ))}
        </ul>

        <p className="text-strong border-line mt-4 flex justify-between border-t pt-4 text-base font-semibold">
          <span>Gesamt</span>
          <span>{formatCents(order.totalCents)}</span>
        </p>
      </section>

      <section className="surface-card mt-4 rounded-2xl p-5">
        <h2 className="text-lg">Abholung</h2>
        <p className="text-muted mt-2 text-sm whitespace-pre-line">{settings.pickupInfo}</p>
      </section>

      <p className="text-muted mt-6 text-xs">
        Der Link zu dieser Seite ist persönlich. Wer ihn hat, sieht deine Bestellung – bitte nicht weitergeben.
      </p>
    </div>
  );
}
