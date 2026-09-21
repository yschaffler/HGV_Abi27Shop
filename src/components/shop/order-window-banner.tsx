import { CalendarClockIcon, CircleAlertIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { OrderWindowStatus } from '@/server/shop/order-window';
import { formatBerlinDateTime } from '@/server/shop/order-window';

/**
 * Hinweis zum Bestellzeitraum. Rein informativ – die verbindliche Prüfung passiert
 * serverseitig beim Anlegen der Bestellung.
 */
export function OrderWindowBanner({
  status,
  closedNotice,
}: {
  status: OrderWindowStatus;
  closedNotice: string | null;
}) {
  if (status.isOpen) {
    if (!status.endAt) return null;

    return (
      <Alert variant="info">
        <CalendarClockIcon aria-hidden="true" />
        <AlertTitle>Bestellschluss: {formatBerlinDateTime(status.endAt)}</AlertTitle>
        <AlertDescription>
          <p>
            Danach geht die Sammelbestellung zum Hersteller. Nachbestellen ist dann nicht mehr
            möglich.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="warning">
      <CircleAlertIcon aria-hidden="true" />
      <AlertTitle>
        {status.state === 'NOT_STARTED'
          ? 'Die Bestellung ist noch nicht geöffnet'
          : 'Der Bestellzeitraum ist beendet'}
      </AlertTitle>
      <AlertDescription>
        <p>
          {status.state === 'NOT_STARTED' && status.startAt
            ? `Es geht los am ${formatBerlinDateTime(status.startAt)}.`
            : (closedNotice ?? 'Es können aktuell keine Bestellungen mehr aufgegeben werden.')}
        </p>
      </AlertDescription>
    </Alert>
  );
}
