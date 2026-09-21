import Link from 'next/link';

const LEGAL_LINKS = [
  { href: '/rechtliches/impressum', label: 'Impressum' },
  { href: '/rechtliches/datenschutz', label: 'Datenschutz' },
  { href: '/rechtliches/widerruf', label: 'Widerruf' },
  { href: '/rechtliches/agb', label: 'AGB' },
];

export function SiteFooter({ shopName, contactEmail }: { shopName: string; contactEmail: string }) {
  return (
    <footer className="bg-night mt-8 border-t border-white/10 text-white/70">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/logo-dark.png" alt="" aria-hidden="true" width={375} height={217} className="h-11 w-auto" />
            <p className="font-display mt-4 text-base font-extrabold tracking-tight text-white">{shopName}</p>
            <p className="mt-2 text-sm">
              Kein Versand: Alle Bestellungen werden gesammelt beim Hersteller aufgegeben und in
              der Schule bei den Q-Sprechern ausgegeben.
            </p>
            {contactEmail ? (
              <a href={`mailto:${contactEmail}`} className="mt-3 inline-block text-sm text-white underline underline-offset-4">
                {contactEmail}
              </a>
            ) : null}
          </div>

          <nav aria-label="Rechtliches">
            <p className="eyebrow text-white/40">Rechtliches</p>
            <ul className="mt-3 space-y-2 text-sm">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/40">
          <p>Die Zahlung wird über Stripe abgewickelt. Zahlungsdaten werden in diesem Shop nicht gespeichert.</p>
        </div>
      </div>
    </footer>
  );
}
