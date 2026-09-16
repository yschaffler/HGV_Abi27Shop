import { describe, expect, it } from 'vitest';
import { evaluateOrderWindow, orderWindowNotice } from '@/server/shop/order-window';

/**
 * Bestellzeitraum. Diese Pruefung entscheidet, ob ueberhaupt eine Bestellung entstehen darf,
 * und laeuft deshalb serverseitig unmittelbar vor dem Anlegen erneut.
 */

const START = new Date('2026-09-20T10:00:00Z');
const END = new Date('2026-10-04T21:59:00Z');

describe('evaluateOrderWindow', () => {
  it('ist vor dem Start geschlossen', () => {
    const status = evaluateOrderWindow({ startAt: START, endAt: END }, new Date('2026-09-19T23:59:59Z'));
    expect(status.isOpen).toBe(false);
    expect(status.state).toBe('NOT_STARTED');
  });

  it('ist ab dem Startzeitpunkt offen', () => {
    const status = evaluateOrderWindow({ startAt: START, endAt: END }, START);
    expect(status.isOpen).toBe(true);
  });

  it('ist bis einschliesslich Bestellschluss offen', () => {
    const status = evaluateOrderWindow({ startAt: START, endAt: END }, END);
    expect(status.isOpen).toBe(true);
  });

  it('ist eine Sekunde nach Bestellschluss geschlossen', () => {
    const status = evaluateOrderWindow(
      { startAt: START, endAt: END },
      new Date(END.getTime() + 1000),
    );
    expect(status.isOpen).toBe(false);
    expect(status.state).toBe('ENDED');
  });

  it('ist ohne gesetzten Zeitraum dauerhaft offen', () => {
    const status = evaluateOrderWindow({ startAt: null, endAt: null }, new Date());
    expect(status.isOpen).toBe(true);
  });

  it('respektiert einen alleinstehenden Bestellschluss', () => {
    expect(evaluateOrderWindow({ startAt: null, endAt: END }, new Date('2026-09-01T00:00:00Z')).isOpen).toBe(true);
    expect(evaluateOrderWindow({ startAt: null, endAt: END }, new Date('2026-11-01T00:00:00Z')).isOpen).toBe(false);
  });
});

describe('orderWindowNotice', () => {
  it('gibt im geoeffneten Zeitraum keinen Hinweis aus', () => {
    const status = evaluateOrderWindow({ startAt: START, endAt: END }, START);
    expect(orderWindowNotice(status, null)).toBeNull();
  });

  it('nennt den Starttermin, wenn es noch nicht losgeht', () => {
    const status = evaluateOrderWindow({ startAt: START, endAt: END }, new Date('2026-09-01T00:00:00Z'));
    expect(orderWindowNotice(status, null)).toContain('20.09.26');
  });

  it('verwendet nach Bestellschluss den hinterlegten Hinweistext', () => {
    const status = evaluateOrderWindow({ startAt: START, endAt: END }, new Date('2026-11-01T00:00:00Z'));
    expect(orderWindowNotice(status, 'Vorbei!')).toBe('Vorbei!');
  });
});
