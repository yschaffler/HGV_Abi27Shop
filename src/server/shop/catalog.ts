import 'server-only';
import { prisma } from '../db';
import type { CatalogVariant } from './pricing';

/**
 * Lesezugriffe auf den Katalog. Der öffentliche Shop sieht ausschließlich aktive
 * Produkte und aktive Varianten; deaktivierte Artikel verschwinden aus dem Shop, bleiben
 * aber für bestehende Bestellungen und die Sammelbestellung erhalten.
 */

export type PublicVariant = {
  id: string;
  color: string;
  size: string;
  label: string;
  priceCents: number;
};

export type PublicProduct = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  imageId: string | null;
  variants: PublicVariant[];
  minPriceCents: number;
  maxPriceCents: number;
};

function toPublicProduct(product: {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  imageId: string | null;
  variants: PublicVariant[];
}): PublicProduct {
  const prices = product.variants.map((variant) => variant.priceCents);
  return {
    ...product,
    minPriceCents: prices.length > 0 ? Math.min(...prices) : 0,
    maxPriceCents: prices.length > 0 ? Math.max(...prices) : 0,
  };
}

const publicVariantSelect = {
  id: true,
  color: true,
  size: true,
  label: true,
  priceCents: true,
} as const;

export async function listPublicProducts(): Promise<PublicProduct[]> {
  const products = await prisma.product.findMany({
    where: { active: true, variants: { some: { active: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      summary: true,
      description: true,
      imageId: true,
      variants: {
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { color: 'asc' }, { size: 'asc' }],
        select: publicVariantSelect,
      },
    },
  });

  return products.map(toPublicProduct);
}

export async function getPublicProductBySlug(slug: string): Promise<PublicProduct | null> {
  const product = await prisma.product.findFirst({
    where: { slug, active: true },
    select: {
      id: true,
      slug: true,
      name: true,
      summary: true,
      description: true,
      imageId: true,
      variants: {
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { color: 'asc' }, { size: 'asc' }],
        select: publicVariantSelect,
      },
    },
  });

  if (!product || product.variants.length === 0) return null;
  return toPublicProduct(product);
}

/**
 * Lädt genau die Varianten, die für eine Preisberechnung gebraucht werden – inklusive
 * der Information, ob Variante und Produkt aktiv sind. Deaktivierte Varianten werden
 * bewusst mitgeladen, damit die Preisberechnung "nicht mehr bestellbar" von
 * "gibt es nicht" unterscheiden kann.
 */
export async function loadVariantsForPricing(variantIds: string[]): Promise<CatalogVariant[]> {
  if (variantIds.length === 0) return [];

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      productId: true,
      color: true,
      size: true,
      label: true,
      priceCents: true,
      active: true,
      product: { select: { name: true, active: true } },
    },
  });

  return variants.map((variant) => ({
    id: variant.id,
    productId: variant.productId,
    productName: variant.product.name,
    productActive: variant.product.active,
    color: variant.color,
    size: variant.size,
    label: variant.label,
    priceCents: variant.priceCents,
    active: variant.active,
  }));
}
