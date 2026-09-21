'use client';

import { useState } from 'react';

/**
 * Bildergalerie für den Hoodie.
 *
 * Bewusst <img> statt next/image: Die Dateien liegen bereits in der richtigen Größe als
 * WebP unter /public und werden vom Reverse Proxy mit langem Cache ausgeliefert. Die
 * Optimierungspipeline von Next würde hier nur einen weiteren Cache und eine weitere
 * Laufzeitabhängigkeit im Container hinzufügen, ohne etwas zu gewinnen.
 */

export type GalleryImage = {
  src: string;
  alt: string;
  /** Beschriftung unter dem Vorschaubild. */
  caption: string;
};

export function HoodieGallery({ images }: { images: GalleryImage[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];
  if (!active) return null;

  return (
    <div>
      {/*
        Die Mockups stehen auf weißem Grund. Auf einer weißen Karte wären die Konturen des
        hellen Hoodies nicht zu erkennen – deshalb der leicht abgesetzte Hintergrund.
      */}
      <div className="bg-surface-muted border-line grid aspect-4/5 w-full place-items-center overflow-hidden rounded-3xl border p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={active.src}
          src={active.src}
          alt={active.alt}
          className="max-h-full w-auto rounded-xl object-contain"
          width={1000}
          height={1250}
          decoding="async"
        />
      </div>

      {images.length > 1 ? (
        <div className="mt-3 flex gap-3">
          {images.map((image, index) => (
            <button
              key={image.src}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-pressed={index === activeIndex}
              className={`grid flex-1 place-items-center overflow-hidden rounded-xl border p-2 transition ${
                index === activeIndex
                  ? 'border-brand-600 bg-brand-500/10'
                  : 'border-line bg-surface-muted hover:border-brand-400'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt=""
                aria-hidden="true"
                className="aspect-4/5 w-full rounded-md object-contain"
                decoding="async"
              />
              <span className="text-muted mt-1 block text-[0.7rem] font-medium">{image.caption}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
