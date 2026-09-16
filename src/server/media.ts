import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { prisma } from './db';
import { env } from './env';
import { logger } from './logger';

/**
 * Produktbilder.
 *
 * Datei-Uploads sind eine klassische Schwachstelle, deshalb hier die Regeln:
 *
 *  - Nur Admins dürfen hochladen (wird im Aufrufer geprüft).
 *  - Maximal 2 MB.
 *  - Erlaubt sind PNG, JPEG und WebP. Geprüft wird am DATEIINHALT (Magic Bytes),
 *    nicht am Dateinamen und nicht am mitgeschickten Content-Type – beides kann gelogen sein.
 *  - Der Dateiname auf der Platte wird selbst erzeugt (UUID + fester Suffix). Der vom
 *    Browser gelieferte Name wird nur als Anzeigetext gespeichert, nie als Pfad benutzt.
 *    Damit ist Path Traversal ("../../etc/passwd") ausgeschlossen.
 *  - Die Dateien liegen ausserhalb von /public und werden nur über einen Route Handler
 *    mit festem Content-Type und nosniff ausgeliefert. Selbst wenn jemand eine Datei mit
 *    eingebettetem Skriptcode hochbekäme, würde sie nie als HTML oder JS interpretiert.
 */

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

type ImageType = { mime: string; extension: string };

const SIGNATURES: Array<{ type: ImageType; matches: (bytes: Uint8Array) => boolean }> = [
  {
    type: { mime: 'image/png', extension: 'png' },
    matches: (b) =>
      b.length > 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    type: { mime: 'image/jpeg', extension: 'jpg' },
    matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: { mime: 'image/webp', extension: 'webp' },
    matches: (b) =>
      b.length > 12 &&
      // "RIFF" .... "WEBP"
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

export function detectImageType(bytes: Uint8Array): ImageType | null {
  return SIGNATURES.find((signature) => signature.matches(bytes))?.type ?? null;
}

function uploadDirectory(): string {
  return resolve(env().UPLOAD_DIR);
}

export type UploadResult = { ok: true; mediaId: string } | { ok: false; message: string };

export async function storeProductImage(params: {
  file: File;
  userId: string;
}): Promise<UploadResult> {
  if (params.file.size === 0) return { ok: false, message: 'Die Datei ist leer.' };
  if (params.file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: 'Das Bild ist zu groß (maximal 2 MB).' };
  }

  const bytes = new Uint8Array(await params.file.arrayBuffer());
  const type = detectImageType(bytes);

  if (!type) {
    return { ok: false, message: 'Nur PNG, JPEG oder WebP sind erlaubt.' };
  }

  // Der Dateiname kommt von uns, nicht vom Browser.
  const storageFilename = `${randomUUID()}.${type.extension}`;
  const directory = uploadDirectory();

  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, storageFilename), bytes, { mode: 0o640 });

  const asset = await prisma.mediaAsset.create({
    data: {
      storageFilename,
      // Nur zur Anzeige. Wird nie als Pfad verwendet und auf eine harmlose Länge gekürzt.
      originalFilename: params.file.name.slice(0, 180),
      mimeType: type.mime,
      byteSize: bytes.byteLength,
      uploadedByUserId: params.userId,
    },
    select: { id: true },
  });

  logger.info('Produktbild hochgeladen', { mediaId: asset.id, bytes: bytes.byteLength, mime: type.mime });

  return { ok: true, mediaId: asset.id };
}

export type StoredMedia = { body: Buffer; mimeType: string };

export async function readStoredMedia(mediaId: string): Promise<StoredMedia | null> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
    select: { storageFilename: true, mimeType: true },
  });

  if (!asset) return null;

  // Doppelte Absicherung: Der Name stammt aus der Datenbank, wird aber trotzdem geprüft.
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(asset.storageFilename)) {
    logger.error('Unerwarteter Dateiname in media_assets', { mediaId });
    return null;
  }

  try {
    const body = await readFile(join(uploadDirectory(), asset.storageFilename));
    return { body, mimeType: asset.mimeType };
  } catch {
    return null;
  }
}
