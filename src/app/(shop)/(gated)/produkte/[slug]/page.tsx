import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeftIcon } from 'lucide-react';
import { ProductShowcase } from '@/components/shop/product-showcase';
import { Button } from '@/components/ui/button';
import { getPublicProductBySlug } from '@/server/shop/catalog';
import { evaluateOrderWindow } from '@/server/shop/order-window';
import { getOrderWindow, getSettings } from '@/server/settings';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);
  return { title: product?.name ?? 'Artikel' };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;

  const [product, window, settings] = await Promise.all([
    getPublicProductBySlug(slug),
    getOrderWindow(),
    getSettings(),
  ]);
  if (!product) notFound();

  const status = evaluateOrderWindow(window);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground mb-8 -ml-3">
        <Link href="/">
          <ArrowLeftIcon aria-hidden="true" />
          Zurück zum Shop
        </Link>
      </Button>

      <ProductShowcase
        product={product}
        orderingOpen={status.isOpen}
        sizeAdvice={settings.sizeAdvice}
        as="h1"
      />
    </div>
  );
}
