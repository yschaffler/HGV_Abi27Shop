import { describe, expect, it } from 'vitest';
import { aggregateItems, type AggregatableItem } from '@/server/export/aggregate';

/**
 * Sammelbestellung: aus vielen Einzelbestellungen wird eine Liste fuer den Hersteller.
 */

function item(overrides: Partial<AggregatableItem & { orderId: string }> = {}) {
  return {
    orderId: 'order-1',
    variantId: 'var-pulli-m',
    productName: 'Abipulli',
    variantLabel: 'Schwarz · M',
    color: 'Schwarz',
    size: 'M',
    quantity: 1,
    unitPriceCents: 3990,
    lineTotalCents: 3990,
    ...overrides,
  };
}

describe('aggregateItems', () => {
  it('summiert Mengen derselben Variante ueber mehrere Bestellungen', () => {
    const rows = aggregateItems([
      item({ orderId: 'a', quantity: 2, lineTotalCents: 7980 }),
      item({ orderId: 'b', quantity: 3, lineTotalCents: 11970 }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.quantity).toBe(5);
    expect(rows[0]?.totalCents).toBe(19950);
  });

  it('zaehlt, in wie vielen Bestellungen eine Variante vorkommt', () => {
    const rows = aggregateItems([
      item({ orderId: 'a' }),
      item({ orderId: 'a' }),
      item({ orderId: 'b' }),
    ]);

    expect(rows[0]?.orderCount).toBe(2);
    expect(rows[0]?.quantity).toBe(3);
  });

  it('haelt verschiedene Varianten auseinander', () => {
    const rows = aggregateItems([
      item({ variantId: 'var-m', size: 'M' }),
      item({ variantId: 'var-l', size: 'L' }),
    ]);

    expect(rows).toHaveLength(2);
  });

  it('sortiert Groessen in Konfektionsreihenfolge statt alphabetisch', () => {
    const rows = aggregateItems([
      item({ variantId: 'v-xxl', size: 'XXL' }),
      item({ variantId: 'v-s', size: 'S' }),
      item({ variantId: 'v-l', size: 'L' }),
      item({ variantId: 'v-m', size: 'M' }),
      item({ variantId: 'v-xl', size: 'XL' }),
    ]);

    expect(rows.map((row) => row.size)).toEqual(['S', 'M', 'L', 'XL', 'XXL']);
  });

  it('sortiert zuerst nach Produkt, dann nach Farbe, dann nach Groesse', () => {
    const rows = aggregateItems([
      item({ variantId: 'a', productName: 'Abi-Shirt', color: 'Schwarz', size: 'M' }),
      item({ variantId: 'b', productName: 'Abipulli', color: 'Bordeaux', size: 'L' }),
      item({ variantId: 'c', productName: 'Abipulli', color: 'Bordeaux', size: 'S' }),
      item({ variantId: 'd', productName: 'Abipulli', color: 'Schwarz', size: 'S' }),
    ]);

    expect(rows.map((row) => `${row.productName}/${row.color}/${row.size}`)).toEqual([
      'Abi-Shirt/Schwarz/M',
      'Abipulli/Bordeaux/S',
      'Abipulli/Bordeaux/L',
      'Abipulli/Schwarz/S',
    ]);
  });

  it('liefert fuer eine leere Eingabe eine leere Liste', () => {
    expect(aggregateItems([])).toEqual([]);
  });
});
