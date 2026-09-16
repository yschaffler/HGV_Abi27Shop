/**
 * Bestellzeitraum.
 *
 * Diese Pruefung laeuft ausschliesslich auf dem Server und wird unmittelbar vor dem Anlegen
 * der Bestellung erneut ausgefuehrt – nicht nur beim Rendern der Seite. Ein Formular, das
 * um 23:58 geoeffnet und um 00:05 abgeschickt wird, erzeugt keine Bestellung mehr.
 */

export type OrderWindow = {
  startAt: Date | null;
  endAt: Date | null;
};

export type OrderWindowState = 'OPEN' | 'NOT_STARTED' | 'ENDED';

export type OrderWindowStatus = {
  state: OrderWindowState;
  isOpen: boolean;
  startAt: Date | null;
  endAt: Date | null;
};

export function evaluateOrderWindow(window: OrderWindow, now: Date = new Date()): OrderWindowStatus {
  const { startAt, endAt } = window;

  if (startAt && now.getTime() < startAt.getTime()) {
    return { state: 'NOT_STARTED', isOpen: false, startAt, endAt };
  }

  if (endAt && now.getTime() > endAt.getTime()) {
    return { state: 'ENDED', isOpen: false, startAt, endAt };
  }

  return { state: 'OPEN', isOpen: true, startAt, endAt };
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Berlin',
});

export function formatBerlinDateTime(value: Date): string {
  return `${DATE_TIME_FORMAT.format(value)} Uhr`;
}

export function orderWindowNotice(status: OrderWindowStatus, fallback?: string | null): string | null {
  switch (status.state) {
    case 'NOT_STARTED':
      return status.startAt
        ? `Die Bestellung startet am ${formatBerlinDateTime(status.startAt)}.`
        : (fallback ?? 'Die Bestellung ist noch nicht geoeffnet.');
    case 'ENDED':
      return fallback ?? 'Der Bestellzeitraum ist abgelaufen. Es koennen keine Bestellungen mehr aufgegeben werden.';
    case 'OPEN':
      return null;
  }
}
