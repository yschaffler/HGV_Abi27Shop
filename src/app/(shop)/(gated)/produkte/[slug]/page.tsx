import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeftIcon, MapPinIcon } from 'lucide-react';
import { AddToCart } from '@/components/shop/add-to-cart';
import { ProductImage } from '@/components/shop/product-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground mb-8 -ml-3">
        <Link href="/">
          <ArrowLeftIcon aria-hidden="true" />
          Zurück zum Shop
        </Link>
      </Button>

      <div className="grid gap-10 md:grid-cols-2">
        <ProductImage
          imageId={product.imageId}
          alt={product.name}
          className="border-border bg-muted aspect-4/5 w-full rounded-3xl border object-cover"
        />

        <div>
          <Badge variant="gold">Sammelbestellung der Q13</Badge>
          <h1 className="mt-3 text-3xl sm:text-4xl">{product.name}</h1>
          <p className="text-foreground mt-3 text-2xl font-semibold">
            {Math.min(...prices) === Math.max(...prices)
              ? formatCents(Math.min(...prices))
              : `${formatCents(Math.min(...prices))} – ${formatCents(Math.max(...prices))}`}
          </p>

          {product.description ? (
            <p className="text-muted-foreground mt-5 whitespace-pre-line">{product.description}</p>
          ) : null}

          <div className="rule-gold my-7" />

          <AddToCart variants={product.variants} disabled={!status.isOpen} />

          <p className="text-muted-foreground mt-6 flex items-start gap-2 text-sm">
            <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Kein Versand – Abholung in der Schule bei den Q-Sprechern.
          </p>
        </div>
      </div>
    </div>
  );
}
