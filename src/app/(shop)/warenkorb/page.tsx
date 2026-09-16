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
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl sm:text-3xl">Warenkorb</h1>

      {!status.isOpen ? (
        <div className="mb-6">
          <OrderWindowBanner status={status} closedNotice={window.closedNotice} />
        </div>
      ) : null}

      <CartView orderingOpen={status.isOpen} />
    </div>
  );
}
