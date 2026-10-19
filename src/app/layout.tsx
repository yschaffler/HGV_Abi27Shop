import type { Metadata, Viewport } from 'next';
// Selbst ausgelieferte Schriften: keine Anfrage an Google Fonts, also keine IP-Übermittlung
// an einen Drittdienst. Bebas Neue (Überschriften) trifft den Schriftzug auf dem Hoodie,
// Inter trägt alles, was gelesen statt betrachtet wird.
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource-variable/inter/wght.css';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: { default: 'HGV-Abi 2027', template: '%s · HGV-Abi 27' },
  description: 'Der Abi-Hoodie des Jahrgangs 2027 – bestellen, bezahlen, in der Schule abholen.',
  // Bestellseiten enthalten personenbezogene Daten und gehören in keinen Suchindex.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Kein maximumScale: Zoom darf nicht gesperrt werden, das wäre ein Barrierefreiheitsproblem.
  themeColor: '#f9f8f6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
