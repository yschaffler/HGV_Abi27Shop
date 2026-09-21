import type { Metadata } from 'next';
import { CartView } from '@/components/shop/cart-view';
import { OrderWindowBanner } from '@/components/shop/order-window-banner';
import { evaluateOrderWindow } from '@/server/shop/order-window';
import { getOrderWindow } from '@/server/settings';

export const metadata: Metadata = { title: 'Warenkorb' };
export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const window = await getOrderWindow();
  const status = evaluateOrderWindow(window);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <p className="eyebrow text-primary">Schritt 1 von 2</p>
      <h1 className="mt-3 text-3xl sm:text-4xl">Warenkorb</h1>
      <p className="text-muted-foreground mt-2 mb-8 max-w-xl text-sm">
        Alles hier landet in der Sammelbestellung der Q13 und wird später in der Schule bei den
        Q-Sprechern ausgegeben.
      </p>

      {!status.isOpen ? (
        <div className="mb-6">
          <OrderWindowBanner status={status} closedNotice={window.closedNotice} />
        </div>
      ) : null}

      <CartView orderingOpen={status.isOpen} />
    </div>
  );
}
