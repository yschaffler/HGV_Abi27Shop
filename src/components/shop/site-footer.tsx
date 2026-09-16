import Link from 'next/link';

const LEGAL_LINKS = [
  { href: '/rechtliches/impressum', label: 'Impressum' },
  { href: '/rechtliches/datenschutz', label: 'Datenschutz' },
  { href: '/rechtliches/widerruf', label: 'Widerruf' },
  { href: '/rechtliches/agb', label: 'AGB' },
];

export function SiteFooter({ shopName, contactEmail }: { shopName: string; contactEmail: string }) {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="text-muted mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          {shopName}
          {contactEmail ? (
            <>
              {' · '}
              <a href={`mailto:${contactEmail}`} className="hover:underline">
                {contactEmail}
              </a>
            </>
          ) : null}
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
