import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccessCodeForm } from '@/components/shop/access-code-form';
import { readAccessState } from '@/server/shop/access';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Zugang', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const LEGAL_LINKS = [
  { href: '/rechtliches/impressum', label: 'Impressum' },
  { href: '/rechtliches/datenschutz', label: 'Datenschutz' },
];

export default async function AccessPage() {
  const [access, settings] = await Promise.all([readAccessState(), getSettings()]);

  // Kein Code gesetzt oder schon freigeschaltet: Diese Seite hat dann keinen Zweck.
  if (!access.required || access.unlocked) redirect('/');

  return (
    <div className="bg-night flex min-h-dvh flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/logo-dark.png"
            alt="HGV Abi 2027"
            width={375}
            height={217}
            className="mx-auto h-20 w-auto"
          />

          <h1 className="font-display text-creme-200 mt-6 text-center text-3xl font-bold tracking-wide">
            {settings.shopName}
          </h1>
          <p className="text-creme-300/60 mt-2 text-center text-sm">
            Die Sammelbestellung der Q13 am Humboldt-Gymnasium Vaterstetten. Der Shop ist nur
            mit Zugangscode erreichbar.
          </p>

          <div className="mt-8">
            <AccessCodeForm hint={access.hint} />
          </div>

          <nav className="text-creme-300/45 mt-10 flex justify-center gap-5 text-xs">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-creme-200 transition">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </main>
    </div>
  );
}
