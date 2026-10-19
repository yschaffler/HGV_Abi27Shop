'use client';

import { useState } from 'react';
import { ProductImage } from '@/components/shop/product-image';
import type { PublicProductImage } from '@/server/shop/catalog';

/**
 * Bildergalerie eines Produkts. Die Bilder pflegt der Adminbereich (Produkte › Bilder);
 * das erste ist das Titelbild.
 *
 * Der Rahmen ist hell und das Bild wird nur eingepasst, nicht beschnitten: So stehen
 * freigestellte Mockups und echte Fotos mit Hintergrund gleichermaßen ordentlich da.
 */
export function ProductGallery({
  productName,
  images,
}: {
  productName: string;
  images: PublicProductImage[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  const altFor = (image: PublicProductImage) =>
    image.caption ? `${productName} – ${image.caption}` : productName;

  return (
    <div>
      <div className="bg-muted border-border grid aspect-4/5 w-full place-items-center overflow-hidden rounded-3xl border">
        <ProductImage
          key={active?.mediaId ?? 'leer'}
          imageId={active?.mediaId ?? null}
          alt={active ? altFor(active) : productName}
          className="size-full object-contain"
        />
      </div>

      {images.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-3">
          {images.map((image, index) => (
            <button
              key={image.mediaId}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-pressed={index === activeIndex}
              aria-label={`Bild ${index + 1}${image.caption ? `: ${image.caption}` : ''} anzeigen`}
              className={`bg-muted grid place-items-center overflow-hidden rounded-xl border p-1.5 transition ${
                index === activeIndex ? 'border-primary ring-primary ring-1' : 'border-border hover:border-foreground/40'
              }`}
            >
              <ProductImage imageId={image.mediaId} alt="" className="aspect-4/5 w-full rounded-md object-contain" />
              {image.caption ? (
                <span className="text-muted-foreground mt-1 block truncate text-[0.7rem] font-medium">{image.caption}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
