import { describe, expect, it } from 'vitest';
import { prisma } from '@/server/db';
import { listPublicProducts } from '@/server/shop/catalog';
import {
  MAX_IMAGES_PER_PRODUCT,
  attachProductImage,
  moveProductImage,
  removeProductImage,
  updateProductImageCaption,
} from '@/server/shop/product-images';
import { createProductWithVariant } from './factories';

/**
 * Produktgalerie.
 *
 * Wichtig ist die Reihenfolge: Das erste Bild ist das Titelbild im Hero und in der
 * Übersicht. Und die Grenze pro Produkt muss serverseitig halten, nicht nur im Formular.
 */

const ACTOR = { id: null, email: 'admin@example.de' };

async function media(): Promise<string> {
  const asset = await prisma.mediaAsset.create({
    data: {
      storageFilename: `${crypto.randomUUID()}.webp`,
      originalFilename: 'bild.webp',
      mimeType: 'image/webp',
      byteSize: 1,
    },
    select: { id: true },
  });
  return asset.id;
}

async function captionsInOrder(productId: string): Promise<string[]> {
  const images = await prisma.productImage.findMany({
    where: { productId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { caption: true },
  });
  return images.map((image) => image.caption);
}

async function idOf(productId: string, caption: string): Promise<string> {
  const image = await prisma.productImage.findFirstOrThrow({ where: { productId, caption }, select: { id: true } });
  return image.id;
}

describe('Bilder anhängen', () => {
  it('hängt neue Bilder hinten an und liefert sie im Katalog in dieser Reihenfolge', async () => {
    const { product } = await createProductWithVariant();

    for (const caption of ['Vorne', 'Hinten', 'Detail']) {
      const result = await attachProductImage({ productId: product.id, mediaId: await media(), caption, actor: ACTOR });
      expect(result.ok).toBe(true);
    }

    const [listed] = await listPublicProducts();
    expect(listed?.images.map((image) => image.caption)).toEqual(['Vorne', 'Hinten', 'Detail']);
  });

  it('lehnt mehr als die erlaubte Anzahl ab', async () => {
    const { product } = await createProductWithVariant();

    for (let index = 0; index < MAX_IMAGES_PER_PRODUCT; index += 1) {
      await attachProductImage({ productId: product.id, mediaId: await media(), caption: `${index}`, actor: ACTOR });
    }

    const result = await attachProductImage({ productId: product.id, mediaId: await media(), caption: 'zu viel', actor: ACTOR });
    expect(result.ok).toBe(false);
    expect(await prisma.productImage.count({ where: { productId: product.id } })).toBe(MAX_IMAGES_PER_PRODUCT);
  });

  it('meldet ein unbekanntes Produkt', async () => {
    const result = await attachProductImage({ productId: 'gibt-es-nicht', mediaId: await media(), caption: '', actor: ACTOR });
    expect(result.ok).toBe(false);
  });

  it('protokolliert das Hinzufügen', async () => {
    const { product } = await createProductWithVariant();
    await attachProductImage({ productId: product.id, mediaId: await media(), caption: 'Vorne', actor: ACTOR });

    const entry = await prisma.auditLog.findFirst({ where: { action: 'PRODUCT_IMAGE_ADDED', entityId: product.id } });
    expect(entry).not.toBeNull();
  });
});

describe('Reihenfolge ändern', () => {
  it('tauscht ein Bild mit seinem Nachbarn', async () => {
    const { product } = await createProductWithVariant();
    for (const caption of ['A', 'B', 'C']) {
      await attachProductImage({ productId: product.id, mediaId: await media(), caption, actor: ACTOR });
    }

    await moveProductImage(await idOf(product.id, 'C'), 'up');
    expect(await captionsInOrder(product.id)).toEqual(['A', 'C', 'B']);

    await moveProductImage(await idOf(product.id, 'A'), 'down');
    expect(await captionsInOrder(product.id)).toEqual(['C', 'A', 'B']);
  });

  it('lässt das erste Bild beim Hochschieben stehen', async () => {
    const { product } = await createProductWithVariant();
    for (const caption of ['A', 'B']) {
      await attachProductImage({ productId: product.id, mediaId: await media(), caption, actor: ACTOR });
    }

    await moveProductImage(await idOf(product.id, 'A'), 'up');
    expect(await captionsInOrder(product.id)).toEqual(['A', 'B']);
  });

  it('kommt mit doppelten sortOrder-Werten zurecht, wie sie die Migration erzeugen kann', async () => {
    const { product } = await createProductWithVariant();
    for (const caption of ['A', 'B']) {
      await prisma.productImage.create({ data: { productId: product.id, mediaId: await media(), caption, sortOrder: 0 } });
    }
    const before = await captionsInOrder(product.id);

    await moveProductImage(await idOf(product.id, before[1] as string), 'up');
    expect(await captionsInOrder(product.id)).toEqual([before[1], before[0]]);
  });
});

describe('Beschriften und entfernen', () => {
  it('ändert die Beschriftung', async () => {
    const { product } = await createProductWithVariant();
    await attachProductImage({ productId: product.id, mediaId: await media(), caption: 'alt', actor: ACTOR });

    const result = await updateProductImageCaption(await idOf(product.id, 'alt'), 'Neu');
    expect(result.ok).toBe(true);
    expect(await captionsInOrder(product.id)).toEqual(['Neu']);
  });

  it('entfernt ein Bild und protokolliert es', async () => {
    const { product } = await createProductWithVariant();
    await attachProductImage({ productId: product.id, mediaId: await media(), caption: 'weg', actor: ACTOR });

    const result = await removeProductImage(await idOf(product.id, 'weg'), ACTOR);
    expect(result.ok).toBe(true);
    expect(await prisma.productImage.count({ where: { productId: product.id } })).toBe(0);

    const entry = await prisma.auditLog.findFirst({ where: { action: 'PRODUCT_IMAGE_REMOVED', entityId: product.id } });
    expect(entry).not.toBeNull();
  });

  it('meldet ein unbekanntes Bild, statt still nichts zu tun', async () => {
    expect((await removeProductImage('gibt-es-nicht', ACTOR)).ok).toBe(false);
    expect((await updateProductImageCaption('gibt-es-nicht', 'x')).ok).toBe(false);
    expect((await moveProductImage('gibt-es-nicht', 'up')).ok).toBe(false);
  });
});
