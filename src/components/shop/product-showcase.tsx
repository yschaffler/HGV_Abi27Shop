import { ExternalLinkIcon, MapPinIcon } from 'lucide-react';
import { AddToCart } from '@/components/shop/add-to-cart';
import { ProductGallery } from '@/components/shop/product-gallery';
import { Badge } from '@/components/ui/badge';
import { formatCents } from '@/lib/money';
import { PRINT_PARTNER } from '@/lib/print-partner';
import type { PublicProduct } from '@/server/shop/catalog';

/**
 * Ein Artikel mit Galerie, Beschreibung und Bestellauswahl. Steht auf der Startseite
 * einmal pro Produkt und auf der Einzelseite /produkte/<slug>.
 */
export function ProductShowcase({
  product,
  orderingOpen,
  sizeAdvice,
  reverse = false,
  as: Heading = 'h2',
}: {
  product: PublicProduct;
  orderingOpen: boolean;
  sizeAdvice: string;
  /** Galerie rechts statt links – damit zwei Artikel untereinander nicht gleichförmig wirken. */
  reverse?: boolean;
  as?: 'h1' | 'h2';
}) {
  const price =
    product.minPriceCents === product.maxPriceCents
      ? formatCents(product.minPriceCents)
      : `${formatCents(product.minPriceCents)} – ${formatCents(product.maxPriceCents)}`;

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-12">
      <div className={reverse ? 'md:order-2' : undefined}>
        <ProductGallery productName={product.name} images={product.images} />
      </div>

      <div className="md:pt-2">
        <Badge variant="ink">Sammelbestellung der Q13</Badge>
        <Heading className="mt-4 text-3xl sm:text-4xl">{product.name}</Heading>

        {product.model ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Modell <span className="text-foreground font-medium">{product.model}</span>, bedruckt von{' '}
            <a
              href={PRINT_PARTNER.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:no-underline"
            >
              {PRINT_PARTNER.name}
              <ExternalLinkIcon className="size-3" aria-hidden="true" />
              <span className="sr-only">(öffnet in neuem Tab)</span>
            </a>
          </p>
        ) : null}

        <p className="text-foreground mt-4 text-2xl font-semibold">{price}</p>

        {product.description ? (
          <p className="text-muted-foreground mt-5 whitespace-pre-line">{product.description}</p>
        ) : product.summary ? (
          <p className="text-muted-foreground mt-5">{product.summary}</p>
        ) : null}

        <div className="rule text-foreground my-7" />

        <AddToCart variants={product.variants} disabled={!orderingOpen} sizeAdvice={sizeAdvice} />

        <p className="text-muted-foreground mt-6 flex items-start gap-2 text-sm">
          <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Kein Versand – Abholung in der Schule bei den Q-Sprechern.
        </p>
      </div>
    </div>
  );
}
