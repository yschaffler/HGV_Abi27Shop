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
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/" className="text-muted mb-6 inline-block text-sm hover:underline">
        ← Alle Artikel
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <ProductImage
          imageId={product.imageId}
          alt={product.name}
          className="surface-card aspect-4/3 w-full rounded-2xl object-cover"
        />

        <div>
          <h1 className="text-2xl sm:text-3xl">{product.name}</h1>
          <p className="text-strong mt-2 text-xl font-semibold">
            {Math.min(...prices) === Math.max(...prices)
              ? formatCents(Math.min(...prices))
              : `${formatCents(Math.min(...prices))} – ${formatCents(Math.max(...prices))}`}
          </p>

          {product.description ? (
            <p className="text-muted mt-4 whitespace-pre-line">{product.description}</p>
          ) : null}

          <hr className="border-line my-6" />

          <AddToCart variants={product.variants} disabled={!status.isOpen} />
        </div>
      </div>
    </div>
  );
}
