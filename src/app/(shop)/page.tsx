import Link from 'next/link';
import { OrderWindowBanner } from '@/components/shop/order-window-banner';
import { ProductImage } from '@/components/shop/product-image';
import { formatCents } from '@/lib/money';
import { listPublicProducts } from '@/server/shop/catalog';
import { evaluateOrderWindow } from '@/server/shop/order-window';
import { getOrderWindow, getSettings } from '@/server/settings';

// Produkte und Bestellzeitraum ändern sich während der Bestellphase – nicht statisch cachen.
export const dynamic = 'force-dynamic';

export default async function ShopHomePage() {
  const [products, settings, window] = await Promise.all([
    listPublicProducts(),
    getSettings(),
    getOrderWindow(),
  ]);

  const status = evaluateOrderWindow(window);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl">{settings.shopName}</h1>
        <p className="text-muted mt-2 max-w-2xl">
          Artikel aussuchen, online bezahlen, später in der Schule abholen. Es gibt keinen Versand –
          alles wird gesammelt bestellt und gemeinsam ausgegeben.
        </p>
      </header>

      <div className="mb-8">
        <OrderWindowBanner status={status} closedNotice={window.closedNotice} />
      </div>

      {products.length === 0 ? (
        <p className="text-muted surface-card rounded-xl px-4 py-8 text-center">
          Aktuell sind keine Artikel verfügbar.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <li key={product.id}>
              <Link
                href={`/produkte/${product.slug}`}
                className="surface-card group block h-full overflow-hidden rounded-2xl transition hover:shadow-lg"
              >
                <ProductImage
                  imageId={product.imageId}
                  alt={product.name}
                  className="aspect-4/3 w-full object-cover"
                />
                <div className="p-4">
                  <h2 className="text-lg group-hover:text-brand-600">{product.name}</h2>
                  {product.summary ? <p className="text-muted mt-1 text-sm">{product.summary}</p> : null}
                  <p className="text-strong mt-3 font-semibold">
                    {product.minPriceCents === product.maxPriceCents
                      ? formatCents(product.minPriceCents)
                      : `ab ${formatCents(product.minPriceCents)}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="surface-card mt-10 rounded-2xl p-5">
        <h2 className="text-lg">So läuft es ab</h2>
        <ol className="text-muted mt-3 grid gap-3 text-sm sm:grid-cols-4">
          {[
            ['1', 'Bestellen', 'Artikel und Größe aussuchen.'],
            ['2', 'Bezahlen', 'Online bezahlen, direkt beim Bestellen.'],
            ['3', 'Sammelbestellung', 'Wir bestellen alles gemeinsam beim Hersteller.'],
            ['4', 'Abholen', 'Ausgabe in der Schule am zentralen Ausgabepunkt.'],
          ].map(([step, title, text]) => (
            <li key={step}>
              <span className="grid size-7 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {step}
              </span>
              <p className="text-strong mt-2 font-semibold">{title}</p>
              <p className="mt-0.5">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
