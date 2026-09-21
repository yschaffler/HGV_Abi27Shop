import { describe, expect, it } from 'vitest';
import { priceCart, type CatalogVariant } from '@/server/shop/pricing';
import { ORDER_LIMITS, cartSchema, checkoutSchema } from '@/lib/validation/order';

/**
 * Preisberechnung – der sicherheitskritischste Teil des Shops.
 *
 * Kernaussage dieser Tests: Ein Preis aus dem Browser kann den Gesamtbetrag nicht
 * beeinflussen, weil er in die Berechnung gar nicht erst hineinkommt.
 */

const PULLOVER: CatalogVariant = {
  id: 'var-pulli-m',
  productId: 'prod-pulli',
  productName: 'Abipulli',
  productActive: true,
  color: 'Schwarz',
  size: 'M',
  label: '',
  priceCents: 3990,
  active: true,
};

const NEWSPAPER: CatalogVariant = {
  id: 'var-zeitung',
  productId: 'prod-zeitung',
  productName: 'Abi-Zeitung',
  productActive: true,
  color: '',
  size: '',
  label: 'Standard',
  priceCents: 1500,
  active: true,
};

const CATALOG = [PULLOVER, NEWSPAPER];

describe('priceCart – korrekte Preise', () => {
  it('rechnet Einzelpreis mal Menge', () => {
    const result = priceCart([{ variantId: PULLOVER.id, quantity: 2 }], CATALOG);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.cart.totalCents).toBe(7980);
    expect(result.cart.lines[0]?.unitPriceCents).toBe(3990);
    expect(result.cart.lines[0]?.lineTotalCents).toBe(7980);
  });

  it('summiert mehrere Positionen', () => {
    const result = priceCart(
      [
        { variantId: PULLOVER.id, quantity: 1 },
        { variantId: NEWSPAPER.id, quantity: 3 },
      ],
      CATALOG,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 39,90 + 3 x 15,00 = 84,90
    expect(result.cart.totalCents).toBe(3990 + 4500);
    expect(result.cart.totalQuantity).toBe(4);
  });

  it('uebernimmt Bezeichnung und Merkmale der Variante in die Position', () => {
    const result = priceCart([{ variantId: PULLOVER.id, quantity: 1 }], CATALOG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.cart.lines[0]?.variantLabel).toBe('Schwarz · M');
    expect(result.cart.lines[0]?.productName).toBe('Abipulli');
  });

  it('nennt eine Variante ohne Farbe und Groesse bei ihrer Bezeichnung', () => {
    const result = priceCart([{ variantId: NEWSPAPER.id, quantity: 1 }], CATALOG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.cart.lines[0]?.variantLabel).toBe('Standard');
  });
});

describe('priceCart – Preismanipulation', () => {
  it('ignoriert einen vom Client mitgeschickten Preis vollstaendig', () => {
    // So saehe ein Manipulationsversuch aus: der Browser behauptet, der Pulli koste 1 Cent.
    const manipulated = [{ variantId: PULLOVER.id, quantity: 2, price: 1, unitPriceCents: 1, lineTotalCents: 2 }];

    const result = priceCart(manipulated, CATALOG);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Gerechnet wird mit dem Preis aus dem Katalog, nicht mit dem behaupteten.
    expect(result.cart.totalCents).toBe(7980);
    expect(result.cart.lines[0]?.unitPriceCents).toBe(3990);
  });

  it('entfernt fremde Felder bereits bei der Validierung', () => {
    const parsed = cartSchema.safeParse([{ variantId: PULLOVER.id, quantity: 1, price: 1 }]);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data[0]).toEqual({ variantId: PULLOVER.id, quantity: 1 });
    expect(parsed.data[0]).not.toHaveProperty('price');
  });

  it('lehnt eine Variante mit unsinnigem Preis in der Datenbank ab', () => {
    const broken: CatalogVariant = { ...PULLOVER, priceCents: 0 };
    const result = priceCart([{ variantId: broken.id, quantity: 1 }], [broken]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INVALID_PRICE');
  });

  it('lehnt negative Preise ab', () => {
    const broken: CatalogVariant = { ...PULLOVER, priceCents: -3990 };
    const result = priceCart([{ variantId: broken.id, quantity: 1 }], [broken]);

    expect(result.ok).toBe(false);
  });
});

describe('priceCart – Mengen', () => {
  it('lehnt Menge 0 ab', () => {
    const result = priceCart([{ variantId: PULLOVER.id, quantity: 0 }], CATALOG);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('QUANTITY_OUT_OF_RANGE');
  });

  it('lehnt negative Mengen ab', () => {
    const result = priceCart([{ variantId: PULLOVER.id, quantity: -5 }], CATALOG);
    expect(result.ok).toBe(false);
  });

  it('lehnt gebrochene Mengen ab', () => {
    const result = priceCart([{ variantId: PULLOVER.id, quantity: 1.5 }], CATALOG);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('QUANTITY_OUT_OF_RANGE');
  });

  it('lehnt Mengen oberhalb der Obergrenze ab', () => {
    const result = priceCart(
      [{ variantId: PULLOVER.id, quantity: ORDER_LIMITS.maxQuantityPerLine + 1 }],
      CATALOG,
    );
    expect(result.ok).toBe(false);
  });

  it('fasst dieselbe Variante zusammen, statt die Obergrenze umgehen zu lassen', () => {
    // Zehnmal "1 Stueck" derselben Variante darf nicht an der Mengenbegrenzung vorbeikommen.
    const lines = Array.from({ length: ORDER_LIMITS.maxQuantityPerLine + 1 }, () => ({
      variantId: PULLOVER.id,
      quantity: 1,
    }));

    const result = priceCart(lines, CATALOG);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('QUANTITY_OUT_OF_RANGE');
  });

  it('fasst mehrfach genannte Varianten korrekt zusammen', () => {
    const result = priceCart(
      [
        { variantId: PULLOVER.id, quantity: 1 },
        { variantId: PULLOVER.id, quantity: 2 },
      ],
      CATALOG,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.cart.lines).toHaveLength(1);
    expect(result.cart.lines[0]?.quantity).toBe(3);
    expect(result.cart.totalCents).toBe(3 * 3990);
  });

  it('begrenzt die Gesamtmenge einer Bestellung', () => {
    const many: CatalogVariant[] = Array.from({ length: 12 }, (_, index) => ({
      ...PULLOVER,
      id: `var-${index}`,
      size: String(index),
    }));

    const lines = many.map((variant) => ({ variantId: variant.id, quantity: 10 }));
    const result = priceCart(lines, many);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('TOTAL_QUANTITY_EXCEEDED');
  });
});

describe('priceCart – ungueltige Varianten', () => {
  it('lehnt unbekannte Varianten ab', () => {
    const result = priceCart([{ variantId: 'gibt-es-nicht', quantity: 1 }], CATALOG);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNKNOWN_VARIANT');
  });

  it('lehnt deaktivierte Varianten ab', () => {
    const inactive: CatalogVariant = { ...PULLOVER, active: false };
    const result = priceCart([{ variantId: inactive.id, quantity: 1 }], [inactive]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VARIANT_UNAVAILABLE');
  });

  it('lehnt Varianten deaktivierter Produkte ab', () => {
    const inactiveProduct: CatalogVariant = { ...PULLOVER, productActive: false };
    const result = priceCart([{ variantId: inactiveProduct.id, quantity: 1 }], [inactiveProduct]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VARIANT_UNAVAILABLE');
  });

  it('lehnt einen leeren Warenkorb ab', () => {
    const result = priceCart([], CATALOG);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('EMPTY_CART');
  });
});

describe('checkoutSchema', () => {
  const VALID = {
    firstName: 'Max',
    lastName: 'Mustermann',
    email: 'Max@Example.DE',
    className: '13B',
    items: [{ variantId: PULLOVER.id, quantity: 1 }],
    acceptedTerms: true as const,
    acceptedPickup: true as const,
  };

  it('normalisiert die E-Mail-Adresse auf Kleinbuchstaben', () => {
    const parsed = checkoutSchema.safeParse(VALID);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.email).toBe('max@example.de');
  });

  it('akzeptiert Namen mit Umlauten, Bindestrich und Apostroph', () => {
    for (const lastName of ['Müller-Lüdenscheidt', "O'Brien", 'Weiß']) {
      expect(checkoutSchema.safeParse({ ...VALID, lastName }).success).toBe(true);
    }
  });

  it('lehnt Namen mit spitzen Klammern ab', () => {
    const parsed = checkoutSchema.safeParse({ ...VALID, firstName: '<script>alert(1)</script>' });
    expect(parsed.success).toBe(false);
  });

  it('verlangt die Bestaetigung der Bedingungen', () => {
    const parsed = checkoutSchema.safeParse({ ...VALID, acceptedTerms: false });
    expect(parsed.success).toBe(false);
  });

  it('verlangt die Bestaetigung der Abholung bei den Q-Sprechern', () => {
    const parsed = checkoutSchema.safeParse({ ...VALID, acceptedPickup: false });
    expect(parsed.success).toBe(false);
  });

  it('lehnt eine Bestellung ohne Abhol-Haekchen ab, auch wenn das Feld ganz fehlt', () => {
    const { acceptedPickup: _omitted, ...withoutPickup } = VALID;
    const parsed = checkoutSchema.safeParse(withoutPickup);
    expect(parsed.success).toBe(false);
  });

  it('lehnt ungueltige E-Mail-Adressen ab', () => {
    const parsed = checkoutSchema.safeParse({ ...VALID, email: 'kein-at-zeichen' });
    expect(parsed.success).toBe(false);
  });
});
