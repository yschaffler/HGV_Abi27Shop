'use client';

import Link from 'next/link';
import { useCart } from '@/components/use-cart';

export function SiteHeader({ shopName }: { shopName: string }) {
  const { count, ready } = useCart();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface-raised/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="text-strong truncate text-base font-semibold">
          {shopName}
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
            <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
