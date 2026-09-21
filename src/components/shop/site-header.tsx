'use client';

import Link from 'next/link';
import { ShoppingCartIcon } from 'lucide-react';
import { useCart } from '@/components/use-cart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function SiteHeader({ shopName }: { shopName: string }) {
  const { count, ready } = useCart();

  return (
    <header className="border-border bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          {/*
            Zwei Dateien statt eines CSS-Filters: Der Schriftzug ist schwarz, "ABI 2027" ist
            gold. Ein Filter würde entweder das Schwarz sichtbar machen und das Gold zerstören
            oder umgekehrt.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/logo.png"
            alt=""
            aria-hidden="true"
            width={375}
            height={217}
            className="h-9 w-auto shrink-0 dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/logo-dark.png"
            alt=""
            aria-hidden="true"
            width={375}
            height={217}
            className="hidden h-9 w-auto shrink-0 dark:block"
          />
          <span className="min-w-0">
            <span className="font-display text-foreground block truncate text-base leading-tight font-extrabold tracking-tight">
              {shopName}
            </span>
            <span className="text-muted-foreground hidden text-[0.7rem] font-semibold tracking-[0.18em] uppercase sm:block">
              Sammelbestellung Q13
            </span>
          </span>
        </Link>

        <Button asChild variant="outline" className="relative">
          <Link href="/warenkorb" aria-label={`Warenkorb${ready && count > 0 ? `, ${count} Artikel` : ''}`}>
            <ShoppingCartIcon aria-hidden="true" />
            <span className="hidden sm:inline">Warenkorb</span>
            {/* Erst nach dem Lesen des localStorage anzeigen, sonst blitzt eine falsche Zahl auf. */}
            {ready && count > 0 ? (
              <Badge className="absolute -top-2 -right-2 size-5 justify-center rounded-full px-0 text-[11px] tabular-nums">
                {count > 99 ? '99+' : count}
              </Badge>
            ) : null}
          </Link>
        </Button>
      </div>
    </header>
  );
}
