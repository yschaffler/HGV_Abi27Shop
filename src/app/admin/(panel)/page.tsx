import Link from 'next/link';
import type { Metadata } from 'next';
import { StatCard } from '@/components/admin/stat-card';
import { formatCents } from '@/lib/money';
import { loadStatistics } from '@/server/admin/statistics';
import { evaluateOrderWindow, formatBerlinDateTime } from '@/server/shop/order-window';
import { getOrderWindow, getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Übersicht', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const [stats, window, settings] = await Promise.all([loadStatistics(), getOrderWindow(), getSettings()]);
  const status = evaluateOrderWindow(window);

  const legalPending = [settings.imprintText, settings.privacyText, settings.withdrawalText, settings.termsText].some(
    (text) => text.trim().length === 0 || text.trim().startsWith('[Vor dem Livegang'),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl">Übersicht</h1>

      {legalPending ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">Rechtstexte fehlen noch</p>
          <p className="mt-1">
            Impressum, Datenschutz, Widerruf oder AGB sind noch Platzhalter. Vor dem Livegang
            ausfüllen und prüfen lassen – siehe LEGAL_CHECKLIST.md.{' '}
            <Link href="/admin/settings" className="underline">Zu den Einstellungen</Link>
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-line px-4 py-3 text-sm">
        <span className="text-muted">Bestellzeitraum: </span>
        <span className="text-strong font-medium">
          {status.state === 'OPEN' ? 'geöffnet' : status.state === 'NOT_STARTED' ? 'noch nicht gestartet' : 'beendet'}
        </span>
        {window.startAt ? <span className="text-muted"> · Start {formatBerlinDateTime(window.startAt)}</span> : null}
        {window.endAt ? <span className="text-muted"> · Schluss {formatBerlinDateTime(window.endAt)}</span> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bezahlte Bestellungen" value={String(stats.paidOrderCount)} hint={`${stats.orderCount} insgesamt`} />
        <StatCard label="Einnahmen (bezahlt)" value={formatCents(stats.revenuePaidCents)} />
        <StatCard label="Artikel gesamt" value={String(stats.itemCountPaid)} hint="für die Sammelbestellung" />
        <StatCard
          label="Ausgegeben"
          value={`${stats.distributedItemCount} / ${stats.itemCountPaid}`}
          hint={`${stats.fullyDistributedOrderCount} Bestellungen komplett`}
        />
      </div>

      {stats.pendingOrderCount > 0 ? (
        <p className="text-muted text-sm">
          {stats.pendingOrderCount} Bestellung(en) sind angelegt, aber nicht bezahlt. Diese zählen
          nicht für die Sammelbestellung.
        </p>
      ) : null}

      <section className="surface-card rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">Meistbestellte Varianten</h2>
          <Link href="/admin/export" className="text-sm text-brand-600 hover:underline">
            Zur Sammelbestellung
          </Link>
        </div>

        {stats.topVariants.length === 0 ? (
          <p className="text-muted mt-3 text-sm">Noch keine bezahlten Bestellungen.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {stats.topVariants.map((variant) => (
              <li key={variant.label} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-normal truncate">{variant.label}</span>
                <span className="text-strong font-semibold tabular-nums">{variant.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
