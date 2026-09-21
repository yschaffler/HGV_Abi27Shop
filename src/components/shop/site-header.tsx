'use client';

import Link from 'next/link';
import { useCart } from '@/components/use-cart';

export function SiteHeader({ shopName }: { shopName: string }) {
  const { count, ready } = useCart();

  return (
    <header className="border-line bg-surface/80 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          {/*
            Zwei Dateien statt eines CSS-Filters: Der Schriftzug ist schwarz, "ABI 2027"
            ist gold. Ein Filter würde entweder das Schwarz sichtbar machen und das Gold
            zerstören oder umgekehrt.
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
            <span className="font-display text-strong block truncate text-base leading-tight font-extrabold tracking-tight">
              {shopName}
            </span>
            <span className="text-muted hidden text-[0.7rem] font-semibold tracking-[0.18em] uppercase sm:block">
              Jahrgang 2027
            </span>
          </span>
        </Link>

        <Link
          href="/warenkorb"
          className="btn-secondary relative h-10 px-3"
          aria-label={`Warenkorb${ready && count > 0 ? `, ${count} Artikel` : ''}`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 3h2l2.2 11.3a1.5 1.5 0 0 0 1.5 1.2h8.9a1.5 1.5 0 0 0 1.5-1.2L20 7H5.2" />
            <circle cx="9" cy="20" r="1.4" />
            <circle cx="17.5" cy="20" r="1.4" />
          </svg>
          <span className="hidden sm:inline">Warenkorb</span>
          {/* Erst nach dem Lesen des localStorage anzeigen, sonst blitzt eine falsche Zahl auf. */}
          {ready && count > 0 ? (
            <span className="bg-brand-600 absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full text-[11px] font-bold text-white">
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
