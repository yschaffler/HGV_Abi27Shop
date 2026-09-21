'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { MapPinIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { useCart } from '@/components/use-cart';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';
import { formatCents } from '@/lib/money';
import { ORDER_LIMITS } from '@/lib/validation/order';
import { resolveCartAction, type CartViewState } from '@/app/(shop)/actions';

/**
 * Warenkorbansicht.
 *
 * Der Browser kennt nur Varianten-IDs und Mengen. Produktnamen und Preise kommen bei jedem
 * Aufruf frisch vom Server – dadurch sieht man sofort, wenn ein Artikel zwischenzeitlich
 * deaktiviert oder im Preis geändert wurde.
 */
export function CartView({ orderingOpen }: { orderingOpen: boolean }) {
  const { items, ready, setQuantity, remove } = useCart();
  const [state, setState] = useState<CartViewState | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!ready) return;

    startTransition(async () => {
      const result = await resolveCartAction(items);
      setState(result);

      // Artikel, die es nicht mehr gibt, auch lokal entfernen.
      if (result.ok && result.removed.length > 0) {
        for (const variantId of result.removed) remove(variantId);
      }
    });
  }, [items, ready, remove]);

  if (!ready || (state === null && pending)) {
    return <p className="text-muted-foreground">Warenkorb wird geladen …</p>;
  }

  if (state && !state.ok) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <p>{state.message}</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (!state || state.lines.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-foreground text-lg font-semibold">Der Warenkorb ist leer</p>
          <p className="text-muted-foreground mt-1">Such dir etwas aus – du kannst jederzeit zurück.</p>
          <Button asChild className="mt-5">
            <Link href="/">Zum Hoodie</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <ul className="space-y-3">
        {state.lines.map((line) => (
          <li key={line.variantId}>
            <Card className="gap-0 py-4">
              <CardContent className="flex flex-wrap items-center gap-4 px-4">
                <div className="min-w-40 flex-1">
                  <p className="text-foreground font-semibold">{line.productName}</p>
                  <p className="text-muted-foreground text-sm">{line.variantLabel}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {formatCents(line.unitPriceCents)} je Stück
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <label className="sr-only" htmlFor={`qty-${line.variantId}`}>
                    Menge für {line.productName}
                  </label>
                  <NativeSelect
                    id={`qty-${line.variantId}`}
                    value={line.quantity}
                    onChange={(event) => setQuantity(line.variantId, Number(event.target.value))}
                    className="w-20"
                  >
                    {Array.from({ length: ORDER_LIMITS.maxQuantityPerLine }, (_, index) => index + 1).map(
                      (value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ),
                    )}
                  </NativeSelect>

                  <p className="text-foreground w-24 text-right font-semibold tabular-nums">
                    {formatCents(line.lineTotalCents)}
                  </p>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(line.variantId)}
                    aria-label={`${line.productName} entfernen`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <aside className="h-fit lg:sticky lg:top-20">
        <Card>
          <CardHeader>
            <CardTitle>Zusammenfassung</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Artikel</dt>
                <dd className="tabular-nums">{state.totalQuantity}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Versand</dt>
                <dd>entfällt</dd>
              </div>
            </dl>

            <Separator className="my-3" />

            <p className="text-foreground flex justify-between text-base font-semibold">
              <span>Gesamt</span>
              <span className="tabular-nums">{formatCents(state.totalCents)}</span>
            </p>

            {orderingOpen ? (
              <Button asChild size="lg" className="mt-5 w-full">
                <Link href="/checkout">Zur Kasse</Link>
              </Button>
            ) : (
              <p className="text-muted-foreground mt-5 text-sm">
                Außerhalb des Bestellzeitraums kann nicht bestellt werden.
              </p>
            )}

            <div className="text-muted-foreground mt-4 space-y-2 text-xs">
              <p className="flex items-start gap-2">
                <UsersIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Teil der Sammelbestellung der Q13 – alle Pullis gehen gemeinsam zum Hersteller.
              </p>
              <p className="flex items-start gap-2">
                <MapPinIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Kein Versand. Ausgabe in der Schule bei den Q-Sprechern.
              </p>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
