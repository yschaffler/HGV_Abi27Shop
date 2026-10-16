import type { Metadata, Viewport } from 'next';
// Selbst ausgelieferte Schriften: keine Anfrage an Google Fonts, also keine IP-Übermittlung
// an einen Drittdienst. Cinzel (Überschriften) nimmt den antiken Charakter des Prints auf,
// Inter trägt alles, was gelesen statt betrachtet wird. Bei Inter reicht die reine
// Gewichtsachse "wght"; Cinzel bringt ohnehin nur diese mit.
import '@fontsource-variable/cinzel';
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
    { media: '(prefers-color-scheme: light)', color: '#f9f8f6' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1a36' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
