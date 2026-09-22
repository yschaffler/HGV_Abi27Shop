import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  ItemDistributionToggle,
  OrderDistributionControls,
} from '@/components/admin/distribution-controls';
import { OrderStatusForm } from '@/components/admin/order-status-form';
import { DistributionStatusBadge, PaymentStatusBadge } from '@/components/shop/order-status-badge';
import { formatCents } from '@/lib/money';
import { idSchema } from '@/lib/validation/admin';
import { getOrderDetail } from '@/server/admin/orders';
import { appUrl } from '@/server/env';

export const metadata: Metadata = { title: 'Bestellung', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Berlin',
});

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) notFound();

  const order = await getOrderDetail(parsed.data);
  if (!order) notFound();

  const distributedCount = order.items.filter((item) => item.distributionStatus === 'DISTRIBUTED').length;
  const openCount = order.items.length - distributedCount;

  return (
    <div className="space-y-5">
      <Link href="/admin/orders" className="text-muted-foreground text-sm hover:underline">
        ← Alle Bestellungen
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl">{order.orderNumber}</h1>
        <PaymentStatusBadge status={order.paymentStatus} />
        <DistributionStatusBadge status={order.distributionStatus} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <section className="surface-card rounded-xl p-5">
            <h2 className="text-lg">Positionen</h2>
            <ul className="mt-3 space-y-3">
              {order.items.map((item) => (
                <li key={item.id} className="border-border flex flex-wrap items-start justify-between gap-3 border-b pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="text-foreground font-medium">{item.quantity} × {item.productName}</p>
                    <p className="text-muted-foreground text-sm">{item.variantLabel}</p>
                    <p className="mt-1 text-xs">
                      {item.distributionStatus === 'DISTRIBUTED' ? (
                        <span className="text-success-fg font-semibold">
                          Ausgegeben
                          {item.distributedAt ? ` am ${DATE_FORMAT.format(item.distributedAt)}` : ''}
                          {item.distributedBy ? ` von ${item.distributedBy.name}` : ''}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Noch nicht ausgegeben</span>
                      )}
                    </p>
                    {order.paymentStatus === 'PAID' ? (
                      <div className="mt-2">
                        <ItemDistributionToggle
                          itemId={item.id}
                          distributed={item.distributionStatus === 'DISTRIBUTED'}
                        />
                      </div>
                    ) : null}
                  </div>
                  <p className="text-foreground font-semibold tabular-nums">{formatCents(item.lineTotalCents)}</p>
                </li>
              ))}
            </ul>

            <p className="text-foreground border-border mt-4 flex justify-between border-t pt-4 font-semibold">
              <span>Gesamt</span>
              <span className="tabular-nums">{formatCents(order.totalCents)}</span>
            </p>
          </section>

          {order.paymentStatus === 'PAID' ? (
            <section className="surface-card rounded-xl p-5">
              <h2 className="text-lg">Ausgabe</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {distributedCount} von {order.items.length} Position(en) ausgegeben.
              </p>
              <div className="mt-4">
                <OrderDistributionControls
                  orderId={order.id}
                  hasDistributed={distributedCount > 0}
                  hasOpen={openCount > 0}
                />
              </div>
            </section>
          ) : null}

          <section className="surface-card rounded-xl p-5">
            <h2 className="text-lg">Status ändern</h2>
            <div className="mt-4">
              <OrderStatusForm
                orderId={order.id}
                paymentStatus={order.paymentStatus}
                fulfillmentStatus={order.fulfillmentStatus}
              />
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="surface-card rounded-xl p-5">
            <h2 className="text-lg">Besteller</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="text-foreground">{order.firstName} {order.lastName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">E-Mail</dt>
                <dd className="text-foreground break-all">{order.email}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Bestellt am</dt>
                <dd className="text-foreground">{DATE_FORMAT.format(order.createdAt)}</dd>
              </div>
              {order.paidAt ? (
                <div>
                  <dt className="text-muted-foreground">Bezahlt am</dt>
                  <dd className="text-foreground">{DATE_FORMAT.format(order.paidAt)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Bestätigungsmail</dt>
                <dd className="text-foreground">
                  {order.confirmationEmailSentAt ? DATE_FORMAT.format(order.confirmationEmailSentAt) : 'nicht versendet'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="surface-card rounded-xl p-5">
            <h2 className="text-lg">Zahlung</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Stripe Checkout Session</dt>
                <dd className="text-foreground font-mono text-xs break-all">{order.stripeCheckoutSessionId ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Stripe Payment Intent</dt>
                <dd className="text-foreground font-mono text-xs break-all">{order.stripePaymentIntentId ?? '—'}</dd>
              </div>
            </dl>
            <p className="text-muted-foreground mt-3 text-xs">
              Es werden keinerlei Zahlungsdaten gespeichert – nur diese Referenzen zu Stripe.
            </p>
          </section>

          <section className="surface-card rounded-xl p-5">
            <h2 className="text-lg">Link für den Besteller</h2>
            <p className="text-muted-foreground mt-2 text-xs break-all">{appUrl(`/bestellung/${order.publicToken}`)}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Dieser Link ist das einzige Zugangsmerkmal zur Bestellung. Nur an den Besteller selbst weitergeben.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
