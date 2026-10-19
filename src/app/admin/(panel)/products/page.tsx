import type { Metadata } from 'next';
import { Disclosure } from '@/components/admin/disclosure';
import { ProductForm } from '@/components/admin/product-form';
import { ProductImages } from '@/components/admin/product-images';
import { VariantForm } from '@/components/admin/variant-form';
import { ProductImage } from '@/components/shop/product-image';
import { centsToEuroInput, formatCents } from '@/lib/money';
import { variantLabel } from '@/lib/variant-label';
import { prisma } from '@/server/db';
import { MAX_IMAGES_PER_PRODUCT } from '@/server/shop/product-images';

export const metadata: Metadata = { title: 'Produkte', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, mediaId: true, caption: true },
      },
      variants: {
        orderBy: [{ sortOrder: 'asc' }, { color: 'asc' }, { size: 'asc' }],
        include: { _count: { select: { items: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl">Produkte</h1>

      <p className="text-muted-foreground text-sm">
        Produkte und Varianten werden nicht gelöscht, sondern deaktiviert. Damit bleiben bereits
        aufgegebene Bestellungen und die Sammelbestellung dauerhaft korrekt auswertbar.
      </p>

      <div className="surface-card rounded-xl p-5">
        <Disclosure summary="Neues Produkt anlegen">
          <ProductForm />
        </Disclosure>
      </div>

      {products.map((product) => (
        <section key={product.id} className="surface-card rounded-xl p-5">
          <div className="flex flex-wrap items-start gap-4">
            <ProductImage
              imageId={product.images[0]?.mediaId ?? null}
              alt={product.name}
              className="border-border size-20 shrink-0 rounded-lg border object-cover"
            />

            <div className="min-w-48 flex-1">
              <h2 className="text-lg">
                {product.name}{' '}
                {!product.active ? (
                  <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 align-middle text-xs font-semibold">
                    inaktiv
                  </span>
                ) : null}
              </h2>
              <p className="text-muted-foreground text-sm">/produkte/{product.slug}</p>
              {product.model ? <p className="text-muted-foreground text-sm">Modell: {product.model}</p> : null}
              <p className="text-muted-foreground mt-1 text-sm">
                {product.images.length} Bild(er) · {product.variants.length} Variante(n),{' '}
                {product.variants.filter((variant) => variant.active).length} davon bestellbar
              </p>
            </div>
          </div>

          <div className="mt-4">
            <Disclosure summary="Produkt bearbeiten">
              <ProductForm
                product={{
                  id: product.id,
                  slug: product.slug,
                  name: product.name,
                  summary: product.summary ?? '',
                  description: product.description ?? '',
                  model: product.model,
                  active: product.active,
                  sortOrder: product.sortOrder,
                }}
              />
            </Disclosure>
          </div>

          <h3 className="text-foreground mt-5 text-sm font-semibold">Bilder</h3>
          <div className="mt-2">
            <ProductImages
              productId={product.id}
              productName={product.name}
              images={product.images}
              maxImages={MAX_IMAGES_PER_PRODUCT}
            />
          </div>

          <h3 className="text-foreground mt-5 text-sm font-semibold">Varianten</h3>

          {product.variants.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">Noch keine Varianten. Ohne Variante ist das Produkt nicht bestellbar.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {product.variants.map((variant) => (
                <li key={variant.id} className="border-border rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-foreground font-medium">
                      {variantLabel(variant)}
                      {!variant.active ? <span className="text-muted-foreground font-normal"> · inaktiv</span> : null}
                    </span>
                    <span className="text-muted-foreground">
                      {formatCents(variant.priceCents)}
                      {variant._count.items > 0 ? ` · ${variant._count.items}× bestellt` : ''}
                    </span>
                  </div>

                  <div className="mt-2">
                    <Disclosure summary="Bearbeiten" tone="muted">
                      <VariantForm
                        productId={product.id}
                        variant={{
                          id: variant.id,
                          color: variant.color,
                          size: variant.size,
                          label: variant.label,
                          price: centsToEuroInput(variant.priceCents),
                          active: variant.active,
                          sortOrder: variant.sortOrder,
                        }}
                      />
                    </Disclosure>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <Disclosure summary="Variante hinzufügen" tone="accent">
              <VariantForm productId={product.id} />
            </Disclosure>
          </div>
        </section>
      ))}
    </div>
  );
}
