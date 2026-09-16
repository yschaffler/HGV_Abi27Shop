import type { OrderWindowStatus } from '@/server/shop/order-window';
import { formatBerlinDateTime } from '@/server/shop/order-window';

/**
 * Hinweis zum Bestellzeitraum. Rein informativ – die verbindliche Prüfung passiert
 * serverseitig beim Anlegen der Bestellung.
 */
export function OrderWindowBanner({ status, closedNotice }: { status: OrderWindowStatus; closedNotice: string | null }) {
  if (status.isOpen) {
    if (!status.endAt) return null;

    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-100">
        <strong className="font-semibold">Bestellschluss:</strong> {formatBerlinDateTime(status.endAt)}. Danach
        können keine Bestellungen mehr aufgegeben werden.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <p className="font-semibold">
        {status.state === 'NOT_STARTED' ? 'Die Bestellung ist noch nicht geöffnet' : 'Der Bestellzeitraum ist beendet'}
      </p>
      <p className="mt-1">
        {status.state === 'NOT_STARTED' && status.startAt
          ? `Es geht los am ${formatBerlinDateTime(status.startAt)}.`
          : (closedNotice ?? 'Es können aktuell keine Bestellungen aufgegeben werden.')}
      </p>
    </div>
  );
}
