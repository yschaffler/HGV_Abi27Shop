'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckIcon, RulerIcon, ShoppingCartIcon } from 'lucide-react';
import { useCart } from '@/components/use-cart';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { colorSwatch } from '@/lib/color-swatch';
import { formatCents } from '@/lib/money';
import { variantLabel } from '@/lib/variant-label';
import { ORDER_LIMITS } from '@/lib/validation/order';
import type { PublicVariant } from '@/server/shop/catalog';

/**
 * Variantenauswahl und "In den Warenkorb".
 *
 * Bewusst generisch: Das Modell erlaubt beliebige Kombinationen aus Farbe, Größe und einer
 * freien Bezeichnung. Die Auswahl zeigt nur die Dimensionen an, die das jeweilige Produkt
 * tatsächlich hat.
 *
 * Es wird ausschließlich die Varianten-ID in den Warenkorb gelegt. Der Preis daneben ist
 * reine Anzeige; verbindlich ist immer der Preis, den der Server aus der Datenbank liest.
 */
export function AddToCart({
  variants,
  disabled,
  sizeAdvice,
}: {
  variants: PublicVariant[];
  disabled: boolean;
  /** Hinweis zum Anprobieren, aus den Einstellungen. Leer = kein Hinweis. */
  sizeAdvice?: string;
}) {
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
        <div>
          <Label className="mb-2.5">
            Farbe
            {color ? <span className="text-muted-foreground font-normal">· {color}</span> : null}
          </Label>
          {/*
            ToggleGroup statt Auswahlliste: Alle Farben sind auf einen Blick sichtbar, und
            "type=single" sorgt dafür, dass immer genau eine ausgewählt bleibt.
          */}
          <ToggleGroup
            type="single"
            value={color}
            onValueChange={(value) => {
              if (!value) return;
              setColor(value);
              setAdded(false);
            }}
          >
            {colors.map((option) => {
              const swatch = colorSwatch(option);
              return (
                <ToggleGroupItem key={option} value={option} aria-label={`Farbe ${option}`}>
                  {swatch ? (
                    <span
                      aria-hidden="true"
                      className="border-foreground/25 [[data-state=on]_&]:border-primary-foreground/70 size-4 shrink-0 rounded-full border-2"
                      style={{ backgroundColor: swatch }}
                    />
                  ) : null}
                  {option}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>
      ) : null}

      {sizes.length > 0 ? (
        <div>
          <Label className="mb-2.5">Größe</Label>
          <ToggleGroup
            type="single"
            value={size}
            onValueChange={(value) => {
              if (!value) return;
              setSize(value);
              setAdded(false);
            }}
          >
            {sizes.map((option) => (
              <ToggleGroupItem
                key={option}
                value={option}
                size="lg"
                disabled={!sizeAvailable(option)}
                aria-label={`Größe ${option}`}
              >
                {option}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-muted-foreground mt-2 text-xs">Unisex-Schnitt, fällt normal aus.</p>

          {/*
            Der wichtigste Hinweis der ganzen Seite steht genau dort, wo die Entscheidung
            fällt: bei der Größenauswahl. Der Text kommt aus den Einstellungen, weil die
            Namen der Q-Sprecher wechseln.
          */}
          {sizeAdvice ? (
            <div className="border-primary/40 bg-primary/5 mt-3 flex items-start gap-2.5 rounded-lg border border-l-4 p-3">
              <RulerIcon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p className="text-foreground text-sm">{sizeAdvice}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <Separator />

      <div className="flex flex-wrap items-end gap-5">
        <div className="w-24">
          <Label htmlFor="quantity" className="mb-1.5">
            Menge
          </Label>
          <NativeSelect
            id="quantity"
            value={quantity}
            onChange={(event) => {
              setQuantity(Number(event.target.value));
              setAdded(false);
            }}
          >
            {Array.from({ length: ORDER_LIMITS.maxQuantityPerLine }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </NativeSelect>
        </div>

        <p className="font-display text-foreground pb-1 text-4xl leading-none">
          {selected ? formatCents(selected.priceCents * quantity) : '—'}
        </p>
      </div>

      {!selected ? (
        <p className="text-muted-foreground text-sm">Diese Kombination ist nicht verfügbar.</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="xl"
          onClick={handleAdd}
          disabled={!selected || disabled}
          className="flex-1 sm:flex-none"
        >
          <ShoppingCartIcon aria-hidden="true" />
          In den Warenkorb
        </Button>

        {added ? (
          <Button asChild variant="outline" size="xl">
            <Link href="/warenkorb">Zum Warenkorb</Link>
          </Button>
        ) : null}
      </div>

      {added && selected ? (
        <p role="status" className="text-primary flex items-center gap-2 text-sm font-semibold">
          <CheckIcon className="size-4" aria-hidden="true" />
          {quantity} × {variantLabel(selected)} wurde hinzugefügt.
        </p>
      ) : null}

      {disabled ? (
        <p className="text-muted-foreground text-sm">
          Außerhalb des Bestellzeitraums können keine Artikel bestellt werden.
        </p>
      ) : null}
    </div>
  );
}
