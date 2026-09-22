import Link from 'next/link';
import type { Metadata } from 'next';
import { DistributionStatusBadge, PaymentStatusBadge } from '@/components/shop/order-status-badge';
import { formatCents } from '@/lib/money';
import {
  FULFILLMENT_STATUSES,
  ORDER_DISTRIBUTION_STATUSES,
  PAYMENT_STATUSES,
  orderFilterSchema,
} from '@/lib/validation/admin';
import { listOrders } from '@/server/admin/orders';

export const metadata: Metadata = { title: 'Bestellungen', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: 'Zahlung ausstehend',
  PAID: 'Bezahlt',
  FAILED: 'Fehlgeschlagen',
  REFUNDED: 'Erstattet',
  CANCELLED: 'Storniert',
};

const FULFILLMENT_LABEL: Record<string, string> = {
  NEW: 'Neu',
  ORDERED: 'Beim Hersteller bestellt',
  ARRIVED: 'Ware eingetroffen',
};

const DISTRIBUTION_LABEL: Record<string, string> = {
  NOT_DISTRIBUTED: 'Nicht ausgegeben',
  PARTIALLY_DISTRIBUTED: 'Teilweise ausgegeben',
  FULLY_DISTRIBUTED: 'Vollständig ausgegeben',
};

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Berlin',
});

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;

  // Unbekannte oder manipulierte Filterwerte fallen auf die Standardwerte zurück,
  // statt eine Fehlerseite zu erzeugen.
  const parsed = orderFilterSchema.safeParse(query);
  const filter = parsed.success ? parsed.data : orderFilterSchema.parse({});

  const { orders, total, page, pageCount } = await listOrders(filter);

  function pageHref(targetPage: number): string {
    const params = new URLSearchParams();
    if (filter.suche) params.set('suche', filter.suche);
    if (filter.zahlung) params.set('zahlung', filter.zahlung);
    if (filter.sammelbestellung) params.set('sammelbestellung', filter.sammelbestellung);
    if (filter.ausgabe) params.set('ausgabe', filter.ausgabe);
    params.set('seite', String(targetPage));
    return `/admin/orders?${params.toString()}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Bestellungen</h1>
        <p className="text-muted-foreground text-sm">{total} Treffer</p>
      </div>

      {/* Filter als GET-Formular: funktioniert ohne JavaScript und ist teil- und lesbar in der URL. */}
      <form method="get" className="surface-card grid gap-3 rounded-xl p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="suche" className="field-label">Name, Bestellnummer oder E-Mail</label>
          <input id="suche" name="suche" defaultValue={filter.suche ?? ''} maxLength={80} className="field-input" />
        </div>

        <div>
          <label htmlFor="zahlung" className="field-label">Zahlung</label>
          <select id="zahlung" name="zahlung" defaultValue={filter.zahlung ?? ''} className="field-input">
            <option value="">Alle</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>{PAYMENT_LABEL[status]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sammelbestellung" className="field-label">Sammelbestellung</label>
          <select id="sammelbestellung" name="sammelbestellung" defaultValue={filter.sammelbestellung ?? ''} className="field-input">
            <option value="">Alle</option>
            {FULFILLMENT_STATUSES.map((status) => (
              <option key={status} value={status}>{FULFILLMENT_LABEL[status]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ausgabe" className="field-label">Ausgabe</label>
          <select id="ausgabe" name="ausgabe" defaultValue={filter.ausgabe ?? ''} className="field-input">
            <option value="">Alle</option>
            {ORDER_DISTRIBUTION_STATUSES.map((status) => (
              <option key={status} value={status}>{DISTRIBUTION_LABEL[status]}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2 sm:col-span-2">
          <button type="submit" className="btn-primary">Filtern</button>
          <Link href="/admin/orders" className="btn-secondary">Zurücksetzen</Link>
        </div>
      </form>

      {orders.length === 0 ? (
        <p className="text-muted-foreground surface-card rounded-xl px-4 py-10 text-center">Keine Bestellungen gefunden.</p>
      ) : (
        <div className="surface-card overflow-x-auto rounded-xl">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-border text-muted-foreground border-b text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Bestellung</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Artikel</th>
                <th className="px-4 py-3 text-right font-medium">Betrag</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Bestellt</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-border border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="font-mono font-medium text-brand-600 hover:underline">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="text-foreground px-4 py-3">{order.lastName}, {order.firstName}</td>
                  <td className="px-4 py-3 tabular-nums">{order._count.items}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCents(order.totalCents)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <PaymentStatusBadge status={order.paymentStatus} />
                      {order.paymentStatus === 'PAID' ? <DistributionStatusBadge status={order.distributionStatus} /> : null}
                    </div>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">{DATE_FORMAT.format(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="btn-secondary">Zurück</Link>
          ) : (
            <span />
          )}
          <p className="text-muted-foreground text-sm">Seite {page} von {pageCount}</p>
          {page < pageCount ? (
            <Link href={pageHref(page + 1)} className="btn-secondary">Weiter</Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}
