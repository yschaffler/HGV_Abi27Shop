import Link from 'next/link';

const LEGAL_LINKS = [
  { href: '/rechtliches/impressum', label: 'Impressum' },
  { href: '/rechtliches/datenschutz', label: 'Datenschutz' },
  { href: '/rechtliches/widerruf', label: 'Widerruf' },
];

export function SiteFooter({ shopName, contactEmail }: { shopName: string; contactEmail: string }) {
  return (
    <footer className="bg-night mt-8 border-t border-creme-300/15 text-creme-300/70">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/logo-dark.png" alt="HGV Abi 2027" width={375} height={217} className="h-14 w-auto" />
            <p className="font-display text-creme-200 mt-4 text-base font-bold tracking-wide">{shopName}</p>
            <p className="mt-2 text-sm">
              Sammelbestellung der Q13 am Humboldt-Gymnasium Vaterstetten. Kein Versand: Alle
              Bestellungen gehen gemeinsam zum Hersteller und werden in der Schule bei den
              Q-Sprechern ausgegeben.
            </p>
            {contactEmail ? (
              <a
                href={`mailto:${contactEmail}`}
                className="text-creme-200 mt-3 inline-block text-sm underline underline-offset-4"
              >
                {contactEmail}
              </a>
            ) : null}
          </div>

          <nav aria-label="Rechtliches">
            <p className="eyebrow text-gold-400/70">Rechtliches</p>
            <ul className="mt-3 space-y-2 text-sm">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-creme-100 transition">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 border-t border-creme-300/10 pt-6 text-xs text-creme-300/45">
          <p>Die Zahlung wird über Stripe abgewickelt. Zahlungsdaten werden in diesem Shop nicht gespeichert.</p>
        </div>
      </div>
    </footer>
  );
}
