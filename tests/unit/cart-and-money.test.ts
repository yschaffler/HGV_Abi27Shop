import { describe, expect, it } from 'vitest';
import { centsToEuroInput, formatCents, parseEuroInput } from '@/lib/money';
import { cartItemCount, normalizeCart } from '@/lib/cart';
import { variantLabel } from '@/lib/variant-label';
import { ORDER_LIMITS } from '@/lib/validation/order';

describe('Geldbetraege', () => {
  it('formatiert Cent als deutsche Waehrungsangabe', () => {
    // Intl verwendet ein schmales geschuetztes Leerzeichen vor dem Eurozeichen.
    expect(formatCents(3990).replace(/ | /g, ' ')).toBe('39,90 €');
    expect(formatCents(0).replace(/ | /g, ' ')).toBe('0,00 €');
  });

  it('liest Eingaben mit Komma und mit Punkt', () => {
    expect(parseEuroInput('39,90')).toBe(3990);
    expect(parseEuroInput('39.90')).toBe(3990);
    expect(parseEuroInput('15')).toBe(1500);
  });

  it('lehnt unsinnige Preiseingaben ab', () => {
    for (const input of ['', 'abc', '-5', '1,234', '1e5', '39,9,9']) {
      expect(() => parseEuroInput(input)).toThrow();
    }
  });

  it('wandelt Cent wieder in ein Formularfeld zurueck', () => {
    expect(centsToEuroInput(3990)).toBe('39,90');
    expect(centsToEuroInput(1500)).toBe('15,00');
  });
});

describe('normalizeCart', () => {
  it('fasst doppelte Varianten zusammen', () => {
    const cart = normalizeCart([
      { variantId: 'a', quantity: 1 },
      { variantId: 'a', quantity: 2 },
    ]);

    expect(cart).toEqual([{ variantId: 'a', quantity: 3 }]);
  });

  it('klemmt die Menge auf die erlaubte Obergrenze', () => {
    const cart = normalizeCart([{ variantId: 'a', quantity: 999 }]);
    expect(cart[0]?.quantity).toBe(ORDER_LIMITS.maxQuantityPerLine);
  });

  it('entfernt Positionen ohne Menge', () => {
    expect(normalizeCart([{ variantId: 'a', quantity: 0 }])).toEqual([]);
  });

  it('begrenzt die Anzahl verschiedener Artikel', () => {
    const items = Array.from({ length: ORDER_LIMITS.maxLines + 5 }, (_, index) => ({
      variantId: `v${index}`,
      quantity: 1,
    }));

    expect(normalizeCart(items)).toHaveLength(ORDER_LIMITS.maxLines);
  });
});

describe('cartItemCount', () => {
  it('zaehlt die Stueckzahl, nicht die Zeilen', () => {
    expect(cartItemCount([{ variantId: 'a', quantity: 2 }, { variantId: 'b', quantity: 3 }])).toBe(5);
  });
});

describe('variantLabel', () => {
  it('verbindet vorhandene Merkmale mit Trennzeichen', () => {
    expect(variantLabel({ color: 'Schwarz', size: 'L' })).toBe('Schwarz · L');
  });

  it('laesst leere Merkmale weg', () => {
    expect(variantLabel({ color: 'Schwarz', size: '', label: '' })).toBe('Schwarz');
  });

  it('faellt ohne jedes Merkmal auf "Standard" zurueck', () => {
    expect(variantLabel({ color: '', size: '', label: '' })).toBe('Standard');
    expect(variantLabel({})).toBe('Standard');
  });
});
