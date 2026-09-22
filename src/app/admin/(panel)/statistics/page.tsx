import type { Metadata } from 'next';
import { StatCard } from '@/components/admin/stat-card';
import { formatCents } from '@/lib/money';
import { loadStatistics } from '@/server/admin/statistics';

export const metadata: Metadata = { title: 'Statistik', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function StatisticsPage() {
  const stats = await loadStatistics();

  const maxDayOrders = Math.max(1, ...stats.ordersByDay.map((row) => row.orders));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl">Statistik</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bestellungen gesamt" value={String(stats.orderCount)} />
        <StatCard label="Davon bezahlt" value={String(stats.paidOrderCount)} />
        <StatCard label="Einnahmen" value={formatCents(stats.revenuePaidCents)} hint="nur bezahlte Bestellungen" />
        <StatCard
          label="Ausgabefortschritt"
          value={
            stats.itemCountPaid === 0
              ? '—'
              : `${Math.round((stats.distributedItemCount / stats.itemCountPaid) * 100)} %`
          }
          hint={`${stats.distributedItemCount} von ${stats.itemCountPaid} Artikeln`}
        />
      </div>

      <section className="surface-card rounded-xl p-5">
        <h2 className="text-lg">Bezahlte Bestellungen je Tag</h2>

        {stats.ordersByDay.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">Noch keine bezahlten Bestellungen.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {stats.ordersByDay.map((row) => (
              <li key={row.day}>
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-foreground font-medium">{row.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {row.orders} · {formatCents(row.revenueCents)}
                  </span>
                </div>
                <div className="bg-muted mt-1 h-2 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${(row.orders / maxDayOrders) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface-card rounded-xl p-5">
        <h2 className="text-lg">Meistbestellte Varianten</h2>
        {stats.topVariants.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">Noch keine Daten.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {stats.topVariants.map((variant) => (
              <li key={variant.label} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-foreground truncate">{variant.label}</span>
                <span className="text-foreground font-semibold tabular-nums">{variant.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
