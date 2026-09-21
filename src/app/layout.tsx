import type { Metadata, Viewport } from 'next';
// Selbst ausgelieferte Schriften: keine Anfrage an Google Fonts, also keine IP-Übermittlung
// an einen Drittdienst. "wght" ist die reine Gewichtsachse – wir brauchen weder Breiten-
// noch Kursivschnitte, das spart einen guten Teil der Dateien.
import '@fontsource-variable/archivo/wght.css';
import '@fontsource-variable/inter/wght.css';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: { default: 'Abikropolis 2027', template: '%s · Abikropolis 2027' },
  description: 'Der Abi-Hoodie des Jahrgangs 2027 – bestellen, bezahlen, in der Schule abholen.',
  // Bestellseiten enthalten personenbezogene Daten und gehören in keinen Suchindex.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Kein maximumScale: Zoom darf nicht gesperrt werden, das wäre ein Barrierefreiheitsproblem.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f5ef' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1f19' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
