'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Übersicht', exact: true },
  { href: '/admin/orders', label: 'Bestellungen' },
  { href: '/admin/products', label: 'Produkte' },
  { href: '/admin/statistics', label: 'Statistik' },
  { href: '/admin/export', label: 'Sammelbestellung' },
  { href: '/admin/distribution', label: 'Ausgabe' },
  { href: '/admin/users', label: 'Benutzer' },
  { href: '/admin/audit', label: 'Protokoll' },
  { href: '/admin/settings', label: 'Einstellungen' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
              active ? 'bg-brand-600 text-white' : 'text-foreground hover:bg-muted'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
