'use client';

import Link from 'next/link';
import { ShoppingCartIcon } from 'lucide-react';
import { useCart } from '@/components/use-cart';
import { AbiEmblem } from '@/components/shop/abi-emblem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * Kopfzeile.
 *
 * Immer in Navy, unabhaengig vom Farbschema – sie ist der Stoff, auf den gedruckt wird.
 * Dadurch sieht die Seite im hellen und im dunklen Modus oben gleich aus.
 */
export function SiteHeader({ shopName }: { shopName: string }) {
  const { count, ready } = useCart();

  return (
    <header className="bg-night sticky top-0 z-30 border-b border-creme-300/15">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <AbiEmblem className="text-creme-300 h-11 w-11 shrink-0" />
          <span className="min-w-0">
            <span className="font-display text-creme-200 block truncate text-base leading-tight font-bold tracking-wide">
              {shopName}
            </span>
            <span className="hidden text-[0.7rem] font-semibold tracking-[0.2em] text-creme-300/50 uppercase sm:block">
              Sammelbestellung Q13
            </span>
          </span>
        </Link>

        <Button
          asChild
          variant="outline"
          className="relative border-creme-300/30 bg-transparent text-creme-200 hover:bg-creme-300/10 hover:text-creme-100"
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
