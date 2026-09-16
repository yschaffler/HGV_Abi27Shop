import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: { default: 'Abi-Shop', template: '%s · Abi-Shop' },
  description: 'Abi-Artikel bestellen und vorab bezahlen.',
  // Bestellseiten enthalten personenbezogene Daten und gehören in keinen Suchindex.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Kein maximumScale: Zoom darf nicht gesperrt werden, das wäre ein Barrierefreiheitsproblem.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
