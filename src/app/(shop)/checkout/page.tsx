import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckoutForm } from '@/components/shop/checkout-form';
import { OrderWindowBanner } from '@/components/shop/order-window-banner';
import { evaluateOrderWindow } from '@/server/shop/order-window';
import { getOrderWindow, getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Kasse' };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const [window, settings] = await Promise.all([getOrderWindow(), getSettings()]);
  const status = evaluateOrderWindow(window);

  // Außerhalb des Bestellzeitraums wird das Formular gar nicht erst gerendert.
  // Die verbindliche Prüfung passiert trotzdem noch einmal in der Server Action.
  if (!status.isOpen) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <h1 className="mb-6 text-3xl">Kasse</h1>
        <OrderWindowBanner status={status} closedNotice={window.closedNotice} />
        <Link href="/" className="btn-secondary mt-6">
          Zurück zum Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <p className="eyebrow text-brand-600 dark:text-brand-400">Schritt 2 von 2</p>
      <h1 className="mt-3 mb-8 text-3xl sm:text-4xl">Kasse</h1>
      <CheckoutForm pickupInfo={settings.pickupInfo} />
    </div>
  );
}
