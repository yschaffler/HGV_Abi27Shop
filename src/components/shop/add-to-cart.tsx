'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/components/use-cart';
import { colorSwatch } from '@/lib/color-swatch';
import { formatCents } from '@/lib/money';
import { variantLabel } from '@/lib/variant-label';
import { ORDER_LIMITS } from '@/lib/validation/order';
import type { PublicVariant } from '@/server/shop/catalog';

/**
 * Variantenauswahl und "In den Warenkorb".
 *
 * Bewusst generisch: Das Modell erlaubt beliebige Kombinationen aus Farbe, Größe und
 * einer freien Bezeichnung. Die Auswahl zeigt nur die Dimensionen an, die das jeweilige
 * Produkt tatsächlich hat – ein Produkt ohne Farben (z. B. die Abi-Zeitung) bekommt keine
 * leere Farbauswahl.
 *
 * Es wird ausschließlich die Varianten-ID in den Warenkorb gelegt. Der Preis daneben ist
 * reine Anzeige; verbindlich ist immer der Preis, den der Server aus der Datenbank liest.
 */
export function AddToCart({ variants, disabled }: { variants: PublicVariant[]; disabled: boolean }) {
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))], [variants]);
  const sizes = useMemo(() => [...new Set(variants.map((v) => v.size).filter(Boolean))], [variants]);

  const [color, setColor] = useState<string>(colors[0] ?? '');
  const [size, setSize] = useState<string>(sizes[0] ?? '');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const { add } = useCart();

  const selected = useMemo(
    () => variants.find((variant) => variant.color === color && variant.size === size) ?? null,
    [variants, color, size],
  );

  /** Kombinationen, die es nicht gibt, werden ausgegraut statt versteckt – das erklärt sich besser. */
  function sizeAvailable(candidate: string): boolean {
    return variants.some((variant) => variant.color === color && variant.size === candidate);
  }

  function handleAdd() {
    if (!selected || disabled) return;
    add(selected.id, quantity);
    setAdded(true);
  }

  return (
    <div className="space-y-6">
      {colors.length > 0 ? (
        <fieldset>
          <legend className="field-label">
            Farbe{color ? <span className="text-muted font-normal"> · {color}</span> : null}
          </legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((option) => {
              const swatch = colorSwatch(option);
              const isActive = color === option;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setColor(option);
                    setAdded(false);
                  }}
                  aria-pressed={isActive}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-line bg-surface-raised text-strong hover:border-brand-400'
                  }`}
                >
                  {swatch ? (
                    <span
                      aria-hidden="true"
                      className={`size-4 shrink-0 rounded-full border ${
                        isActive ? 'border-white/50' : 'border-black/20'
                      }`}
                      style={{ backgroundColor: swatch }}
                    />
                  ) : null}
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {sizes.length > 0 ? (
        <fieldset>
          <legend className="field-label">Größe</legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((option) => {
              const available = sizeAvailable(option);
              return (
                <button
                  key={option}
                  type="button"
                  disabled={!available}
                  onClick={() => {
                    setSize(option);
                    setAdded(false);
                  }}
                  aria-pressed={size === option}
                  className={`min-w-14 rounded-lg border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    size === option && available
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-line bg-surface-raised text-strong hover:border-brand-400'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <p className="text-muted mt-2 text-xs">
            Unisex-Schnitt, fällt normal aus. Umtausch ist bei einer Sammelbestellung nicht möglich.
          </p>
        </fieldset>
      ) : null}

      <div className="border-line flex flex-wrap items-end gap-5 border-t pt-5">
        <div>
          <label htmlFor="quantity" className="field-label">
            Menge
          </label>
          <select
            id="quantity"
            value={quantity}
            onChange={(event) => {
              setQuantity(Number(event.target.value));
              setAdded(false);
            }}
            className="field-input w-24"
          >
            {Array.from({ length: ORDER_LIMITS.maxQuantityPerLine }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <p className="font-display text-strong pb-1.5 text-3xl font-extrabold tabular-nums">
          {selected ? formatCents(selected.priceCents * quantity) : '—'}
        </p>
      </div>

      {!selected ? (
        <p className="text-muted text-sm">Diese Kombination ist nicht verfügbar.</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!selected || disabled}
          className="btn-primary h-13 flex-1 px-6 text-base sm:flex-none"
        >
          In den Warenkorb
        </button>

        {added ? (
          <Link href="/warenkorb" className="btn-secondary h-13 px-5 text-base">
            Zum Warenkorb
          </Link>
        ) : null}
      </div>

      {added && selected ? (
        <p role="status" className="text-sm font-semibold text-green-700 dark:text-green-400">
          {quantity} × {variantLabel(selected)} wurde hinzugefügt.
        </p>
      ) : null}

      {disabled ? (
        <p className="text-muted text-sm">
          Außerhalb des Bestellzeitraums können keine Artikel bestellt werden.
        </p>
      ) : null}
    </div>
  );
}
