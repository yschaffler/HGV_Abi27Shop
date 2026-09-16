import type { Metadata } from 'next';
import { BulkFulfillmentForm } from '@/components/admin/bulk-fulfillment-form';
import { formatCents } from '@/lib/money';
import { loadAggregateRows } from '@/server/export/exports';

export const metadata: Metadata = { title: 'Sammelbestellung', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ExportPage() {
  const rows = await loadAggregateRows();

  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalCents = rows.reduce((sum, row) => sum + row.totalCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Sammelbestellung</h1>
        <p className="text-muted mt-1 text-sm">
          Aggregiert über alle <strong>bezahlten</strong> Bestellungen. Unbezahlte Bestellungen sind
          bewusst nicht enthalten – sie werden auch nicht beim Hersteller bestellt.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <a href="/api/admin/export?kind=aggregate&format=xlsx" className="btn-primary" download>
          Sammelbestellung als XLSX
        </a>
        <a href="/api/admin/export?kind=aggregate&format=csv" className="btn-secondary" download>
          Sammelbestellung als CSV
        </a>
        <a href="/api/admin/export?kind=details&format=xlsx" className="btn-secondary" download>
          Detailliste als XLSX
        </a>
        <a href="/api/admin/export?kind=details&format=csv" className="btn-secondary" download>
          Detailliste als CSV
        </a>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted surface-card rounded-xl px-4 py-10 text-center">
          Noch keine bezahlten Bestellungen.
        </p>
      ) : (
        <div className="surface-card overflow-x-auto rounded-xl">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-line text-muted border-b text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Produkt</th>
                <th className="px-4 py-3 font-medium">Farbe</th>
                <th className="px-4 py-3 font-medium">Größe</th>
                <th className="px-4 py-3 text-right font-medium">Menge</th>
                <th className="px-4 py-3 text-right font-medium">Einzelpreis</th>
                <th className="px-4 py-3 text-right font-medium">Summe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.variantId} className="border-line border-b last:border-0">
                  <td className="text-strong px-4 py-2.5 font-medium">{row.productName}</td>
                  <td className="px-4 py-2.5">{row.color || '—'}</td>
                  <td className="px-4 py-2.5">{row.size || row.variantLabel || "—"}</td>
                  <td className="text-strong px-4 py-2.5 text-right text-base font-semibold tabular-nums">{row.quantity}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCents(row.unitPriceCents)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCents(row.totalCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-line text-strong border-t font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={3}>Gesamt</td>
                <td className="px-4 py-3 text-right tabular-nums">{totalQuantity}</td>
                <td />
                <td className="px-4 py-3 text-right tabular-nums">{formatCents(totalCents)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <section className="surface-card rounded-xl p-5">
        <h2 className="text-lg">Status der Sammelbestellung</h2>
        <p className="text-muted mt-1 text-sm">
          Wenn die Bestellung beim Hersteller rausgegangen ist oder die Ware angekommen ist,
          lässt sich der Status für alle bezahlten Bestellungen auf einmal setzen.
        </p>
        <div className="mt-4">
          <BulkFulfillmentForm />
        </div>
      </section>
    </div>
  );
}
