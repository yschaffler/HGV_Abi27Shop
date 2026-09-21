import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { AddToCart } from '@/components/shop/add-to-cart';
import { ProductImage } from '@/components/shop/product-image';
import { formatCents } from '@/lib/money';
import { getPublicProductBySlug } from '@/server/shop/catalog';
import { evaluateOrderWindow } from '@/server/shop/order-window';
import { getOrderWindow } from '@/server/settings';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);
  return { title: product?.name ?? 'Artikel' };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;

  const [product, window] = await Promise.all([getPublicProductBySlug(slug), getOrderWindow()]);
  if (!product) notFound();

  const status = evaluateOrderWindow(window);
  const prices = product.variants.map((variant) => variant.priceCents);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <Link href="/" className="text-muted mb-8 inline-block text-sm hover:underline">
        ← Zurück zum Shop
      </Link>

      <div className="grid gap-10 md:grid-cols-2">
        <ProductImage
          imageId={product.imageId}
          alt={product.name}
          className="surface-card aspect-4/5 w-full rounded-3xl object-cover"
        />

        <div>
          <h1 className="text-3xl sm:text-4xl">{product.name}</h1>
          <p className="text-strong mt-3 text-2xl font-semibold">
            {Math.min(...prices) === Math.max(...prices)
              ? formatCents(Math.min(...prices))
              : `${formatCents(Math.min(...prices))} – ${formatCents(Math.max(...prices))}`}
          </p>

          {product.description ? (
            <p className="text-muted mt-5 whitespace-pre-line">{product.description}</p>
          ) : null}

          <div className="rule-gold my-7" />

          <AddToCart variants={product.variants} disabled={!status.isOpen} />

          <p className="text-muted mt-6 text-sm">
            Kein Versand – Abholung in der Schule bei den Q-Sprechern.
          </p>
        </div>
      </div>
    </div>
  );
}
