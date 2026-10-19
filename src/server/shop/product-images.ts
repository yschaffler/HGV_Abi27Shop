import 'server-only';
import { prisma } from '../db';
import { recordAudit, type AuditActor } from '../audit';

/**
 * Bildergalerie der Produkte.
 *
 * Das Hochladen selbst (Größe, Magic Bytes, eigener Dateiname) liegt in server/media.ts.
 * Hier geht es nur um die Zuordnung: welches Bild zu welchem Produkt gehört, in welcher
 * Reihenfolge und mit welcher Beschriftung. Das erste Bild ist das Titelbild.
 *
 * Die Berechtigung prüft der Aufrufer (Server Action mit authorize(['ADMIN'])).
 */

/** Genug für Vorne, Hinten, Detail und ein paar Tragefotos – und klein genug für die Seite. */
export const MAX_IMAGES_PER_PRODUCT = 8;

export type GalleryResult = { ok: true } | { ok: false; message: string };

export async function attachProductImage(params: {
  productId: string;
  mediaId: string;
  caption: string;
  actor: AuditActor;
}): Promise<GalleryResult> {
  const product = await prisma.product.findUnique({
    where: { id: params.productId },
    select: { name: true, images: { select: { sortOrder: true } } },
  });
  if (!product) return { ok: false, message: 'Produkt nicht gefunden.' };

  if (product.images.length >= MAX_IMAGES_PER_PRODUCT) {
    return { ok: false, message: `Höchstens ${MAX_IMAGES_PER_PRODUCT} Bilder pro Produkt.` };
  }

  const nextSortOrder = product.images.reduce((max, image) => Math.max(max, image.sortOrder + 1), 0);

  const image = await prisma.productImage.create({
    data: {
      productId: params.productId,
      mediaId: params.mediaId,
      caption: params.caption,
      sortOrder: nextSortOrder,
    },
    select: { id: true },
  });

  await recordAudit({
    actor: params.actor,
    action: 'PRODUCT_IMAGE_ADDED',
    entityType: 'Product',
    entityId: params.productId,
    summary: `Bild ${image.id} zu "${product.name}" hinzugefügt`,
  });

  return { ok: true };
}

export async function updateProductImageCaption(imageId: string, caption: string): Promise<GalleryResult> {
  const result = await prisma.productImage.updateMany({ where: { id: imageId }, data: { caption } });
  return result.count === 1 ? { ok: true } : { ok: false, message: 'Bild nicht gefunden.' };
}

/**
 * Verschiebt ein Bild um eine Position. Die Reihenfolge wird dabei neu durchnummeriert,
 * damit doppelte oder lückenhafte sortOrder-Werte (etwa aus der Migration) nicht stören.
 */
export async function moveProductImage(imageId: string, direction: 'up' | 'down'): Promise<GalleryResult> {
  const image = await prisma.productImage.findUnique({ where: { id: imageId }, select: { productId: true } });
  if (!image) return { ok: false, message: 'Bild nicht gefunden.' };

  await prisma.$transaction(async (tx) => {
    const siblings = await tx.productImage.findMany({
      where: { productId: image.productId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    const ids = siblings.map((sibling) => sibling.id);
    const from = ids.indexOf(imageId);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from === -1 || to < 0 || to >= ids.length) return;

    [ids[from], ids[to]] = [ids[to] as string, ids[from] as string];

    for (const [index, id] of ids.entries()) {
      await tx.productImage.update({ where: { id }, data: { sortOrder: index } });
    }
  });

  return { ok: true };
}

/**
 * Nimmt ein Bild aus der Galerie. Die Datei selbst bleibt liegen: Sie ist klein, und ein
 * versehentlich entferntes Bild lässt sich so notfalls aus dem Upload-Verzeichnis retten.
 */
export async function removeProductImage(imageId: string, actor: AuditActor): Promise<GalleryResult> {
  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { productId: true, product: { select: { name: true } } },
  });
  if (!image) return { ok: false, message: 'Bild nicht gefunden.' };

  await prisma.productImage.delete({ where: { id: imageId } });

  await recordAudit({
    actor,
    action: 'PRODUCT_IMAGE_REMOVED',
    entityType: 'Product',
    entityId: image.productId,
    summary: `Bild ${imageId} aus "${image.product.name}" entfernt`,
  });

  return { ok: true };
}
