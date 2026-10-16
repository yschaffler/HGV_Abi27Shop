'use client';

import Link from 'next/link';
import { ShoppingCartIcon } from 'lucide-react';
import { useCart } from '@/components/use-cart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * Kopfzeile.
 *
 * Immer in Navy, unabhaengig vom Farbschema – sie ist der Stoff, auf den gedruckt wird.
 * Dadurch sieht die Seite im hellen und im dunklen Modus oben gleich aus.
 *
 * Es gibt zwei Marken im Shop, und sie haben getrennte Aufgaben: Das Jahrgangslogo "HGV
 * ABI 2027" sagt, wer hier bestellt – es steht deshalb in Kopfzeile, Fusszeile und auf der
 * Zugangsseite. Das Lorbeer-Emblem ist der Brustdruck des Hoodies und gehoert damit zum
 * Produkt; es steht beim Artikel.
 */
export function SiteHeader({ shopName }: { shopName: string }) {
  const { count, ready } = useCart();

  return (
    <header className="bg-night border-creme-300/15 sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          {/*
            Die Kopfzeile ist immer dunkel, deshalb reicht die helle Fassung des Logos –
            anders als frueher braucht es hier keine zweite Datei fuer den hellen Modus.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/logo-dark.png"
            alt="HGV Abi 2027"
            width={375}
            height={217}
            className="h-10 w-auto shrink-0"
          />
          <span className="border-creme-300/20 min-w-0 border-l pl-3">
            <span className="font-display text-creme-200 block truncate text-lg leading-tight tracking-wide">
              {shopName}
            </span>
            <span className="text-creme-300/50 hidden text-[0.7rem] font-semibold tracking-[0.2em] uppercase sm:block">
              Sammelbestellung Q13
            </span>
          </span>
        </Link>

        <Button
          asChild
          variant="outline"
          className="border-creme-300/30 text-creme-200 hover:bg-creme-300/10 hover:text-creme-100 relative bg-transparent"
        >
          <Link href="/warenkorb" aria-label={`Warenkorb${ready && count > 0 ? `, ${count} Artikel` : ''}`}>
            <ShoppingCartIcon aria-hidden="true" />
            <span className="hidden sm:inline">Warenkorb</span>
            {/* Erst nach dem Lesen des localStorage anzeigen, sonst blitzt eine falsche Zahl auf. */}
            {ready && count > 0 ? (
              <Badge className="bg-gold-500 text-navy-950 absolute -top-2 -right-2 size-5 justify-center rounded-full px-0 text-[11px] tabular-nums">
                {count > 99 ? '99+' : count}
              </Badge>
            ) : null}
          </Link>
        </Button>
      </div>
    </header>
  );
}
