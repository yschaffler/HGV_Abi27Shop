'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useCart } from '@/components/use-cart';
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
    return <p className="text-muted">Warenkorb wird geladen …</p>;
  }

  if (state && !state.ok) {
    return (
      <div className="surface-card rounded-xl p-4">
        <p className="text-red-700 dark:text-red-400">{state.message}</p>
      </div>
    );
  }

  if (!state || state.lines.length === 0) {
    return (
      <div className="surface-card rounded-2xl px-4 py-12 text-center">
        <p className="text-strong text-lg font-semibold">Der Warenkorb ist leer</p>
        <p className="text-muted mt-1">Such dir etwas aus – du kannst jederzeit zurück.</p>
        <Link href="/" className="btn-primary mt-5">
          Artikel ansehen
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <ul className="space-y-3">
        {state.lines.map((line) => (
          <li key={line.variantId} className="surface-card flex flex-wrap items-center gap-4 rounded-xl p-4">
            <div className="min-w-40 flex-1">
              <p className="text-strong font-semibold">{line.productName}</p>
              <p className="text-muted text-sm">{line.variantLabel}</p>
              <p className="text-muted mt-1 text-sm">{formatCents(line.unitPriceCents)} je Stück</p>
            </div>

            <div className="flex items-center gap-3">
              <label className="sr-only" htmlFor={`qty-${line.variantId}`}>
                Menge für {line.productName}
              </label>
              <select
                id={`qty-${line.variantId}`}
                value={line.quantity}
                onChange={(event) => setQuantity(line.variantId, Number(event.target.value))}
                className="field-input w-20"
              >
                {Array.from({ length: ORDER_LIMITS.maxQuantityPerLine }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>

              <p className="text-strong w-24 text-right font-semibold">{formatCents(line.lineTotalCents)}</p>

              <button
                type="button"
                onClick={() => remove(line.variantId)}
                className="text-muted rounded-lg p-2 hover:text-red-600"
                aria-label={`${line.productName} entfernen`}
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>

      <aside className="surface-card h-fit rounded-2xl p-5 lg:sticky lg:top-20">
        <h2 className="text-lg">Zusammenfassung</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Artikel</dt>
            <dd>{state.totalQuantity}</dd>
          </div>
          <div className="border-line text-strong flex justify-between border-t pt-3 text-base font-semibold">
            <dt>Gesamt</dt>
            <dd>{formatCents(state.totalCents)}</dd>
          </div>
        </dl>

        {orderingOpen ? (
          <Link href="/checkout" className="btn-primary mt-5 w-full">
            Zur Kasse
          </Link>
        ) : (
          <p className="text-muted mt-5 text-sm">
            Außerhalb des Bestellzeitraums kann nicht bestellt werden.
          </p>
        )}

        <p className="text-muted mt-3 text-xs">
          Kein Versand. Die Ausgabe erfolgt in der Schule bei den Q-Sprechern.
        </p>
      </aside>
    </div>
  );
}
