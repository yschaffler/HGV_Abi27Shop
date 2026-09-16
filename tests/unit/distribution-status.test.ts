import { describe, expect, it } from 'vitest';
import {
  deriveOrderDistributionStatus,
  distributionProgress,
} from '@/server/shop/distribution-status';

/**
 * Der Gesamtstatus einer Bestellung wird immer aus den Positionen abgeleitet.
 * Deshalb kann der denormalisierte Wert in der Datenbank nicht von der Wahrheit abweichen.
 */

const OPEN = { distributionStatus: 'NOT_DISTRIBUTED' } as const;
const DONE = { distributionStatus: 'DISTRIBUTED' } as const;

describe('deriveOrderDistributionStatus', () => {
  it('meldet ohne ausgegebene Position NOT_DISTRIBUTED', () => {
    expect(deriveOrderDistributionStatus([OPEN, OPEN, OPEN])).toBe('NOT_DISTRIBUTED');
  });

  it('meldet bei einem Teil PARTIALLY_DISTRIBUTED', () => {
    expect(deriveOrderDistributionStatus([DONE, OPEN, OPEN])).toBe('PARTIALLY_DISTRIBUTED');
    expect(deriveOrderDistributionStatus([DONE, DONE, OPEN])).toBe('PARTIALLY_DISTRIBUTED');
  });

  it('meldet erst bei allen Positionen FULLY_DISTRIBUTED', () => {
    expect(deriveOrderDistributionStatus([DONE, DONE, DONE])).toBe('FULLY_DISTRIBUTED');
  });

  it('behandelt eine Bestellung ohne Positionen als nicht ausgegeben', () => {
    expect(deriveOrderDistributionStatus([])).toBe('NOT_DISTRIBUTED');
  });

  it('gilt auch fuer eine einzelne Position', () => {
    expect(deriveOrderDistributionStatus([DONE])).toBe('FULLY_DISTRIBUTED');
    expect(deriveOrderDistributionStatus([OPEN])).toBe('NOT_DISTRIBUTED');
  });
});

describe('distributionProgress', () => {
  it('formuliert den Fortschritt so, wie er an der Ausgabe angezeigt wird', () => {
    expect(distributionProgress([DONE, DONE, OPEN])).toEqual({
      distributed: 2,
      total: 3,
      label: '2 von 3 Artikeln ausgegeben',
    });
  });
});
