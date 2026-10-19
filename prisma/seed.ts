/**
 * Beispieldaten für die Entwicklung und den ersten Aufbau.
 *
 * Idempotent: mehrfaches Ausführen erzeugt keine Duplikate. Legt bewusst KEINEN
 * Admin-Benutzer an – dafür gibt es scripts/create-admin.ts mit einem echten Passwort.
 *
 * Angelegt werden genau die zwei Artikel der Kollektion: Hoodie und Shirt. Der Hoodie
 * bekommt die Mockups aus public/img als Galeriebilder, damit die Entwicklungsumgebung
 * nicht nur Platzhalter zeigt; die echten Fotos lädt der Adminbereich hoch.
 *
 * Preise und Modelle sind Entwicklungswerte – live pflegt sie der Adminbereich.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL fehlt');

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
/**
 * Beide Artikel gibt es in genau einer Farbe. Das Modell kann mehr – weitere Farben legt
 * der Adminbereich an, ohne dass hier etwas geaendert werden muss.
 */
const COLOR = 'Navy';

type SeedProduct = {
  slug: string;
  name: string;
  model: string;
  summary: string;
  description: string;
  priceCents: number;
  sortOrder: number;
  images: Array<{ file: string; caption: string }>;
};

const PRODUCTS: SeedProduct[] = [
  {
    slug: 'abi-hoodie',
    name: 'Abikropolis Hoodie 2027',
    model: 'Basic Oversize Hoodie',
    summary: 'Navyfarbener Hoodie mit Lorbeer-Emblem vorne und dem Abikropolis-Print auf dem Rücken.',
    description:
      'Vorne links das Lorbeer-Emblem mit Säule und der Jahreszahl 2027, hinten großflächig ' +
      'der Abikropolis-Schriftzug, der Spruch "Die Götter verlassen den Olymp", die Weinranke ' +
      'und darunter alle Namen des Jahrgangs.\n\n' +
      'Oversize-Schnitt – probiert am besten vorher bei den Q-Sprechern an.',
    priceCents: 4490,
    sortOrder: 10,
    images: [
      { file: 'hoodie-front.webp', caption: 'Vorne' },
      { file: 'hoodie-back.webp', caption: 'Hinten' },
      { file: 'hoodie-detail.webp', caption: 'Detail' },
    ],
  },
  {
    slug: 'abi-shirt',
    name: 'Abikropolis Shirt 2027',
    model: 'Premium Oversize Shirt',
    summary: 'Navyfarbenes T-Shirt mit demselben Abikropolis-Print wie der Hoodie.',
    description:
      'Dasselbe Design wie auf dem Hoodie: vorne das Lorbeer-Emblem, hinten der ' +
      'Abikropolis-Schriftzug mit allen Namen des Jahrgangs.\n\n' +
      'Oversize-Schnitt – probiert am besten vorher bei den Q-Sprechern an.',
    priceCents: 2490,
    sortOrder: 20,
    images: [],
  },
];

/** Kopiert ein Mockup aus public/img ins Upload-Verzeichnis, wie es ein Upload täte. */
async function storeSeedImage(file: string): Promise<string> {
  const directory = resolve(process.env['UPLOAD_DIR'] ?? './data/uploads');
  await mkdir(directory, { recursive: true });

  const extension = file.split('.').pop() ?? 'webp';
  const storageFilename = `${randomUUID()}.${extension}`;
  const target = join(directory, storageFilename);
  await copyFile(join('public', 'img', file), target);
  const { size: byteSize } = await stat(target);

  const mimeType = extension === 'png' ? 'image/png' : extension === 'jpg' ? 'image/jpeg' : 'image/webp';
  const asset = await prisma.mediaAsset.create({
    data: { storageFilename, originalFilename: file, mimeType, byteSize },
    select: { id: true },
  });
  return asset.id;
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function main(): Promise<void> {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      shopName: 'Abikropolis 2027',
      contactEmail: 'abi2027@example.de',
      // Relativ zum Seed-Lauf, damit die Entwicklungsdaten nicht nach ein paar Wochen
      // einen geschlossenen Shop zeigen. In Produktion setzt der Adminbereich die Termine.
      orderStartAt: daysFromNow(-7),
      orderEndAt: daysFromNow(14),
      pickupInfo:
        'Die gesamte Q13 bestellt gemeinsam: Nach dem Bestellschluss geht ein einziger Auftrag ' +
        'zum Hersteller. Sobald die Lieferung da ist, werden Hoodies und Shirts in der Schule bei den ' +
        'Q-Sprechern ausgegeben. Es gibt keinen Versand. Den genauen Ausgabetermin geben wir ' +
        'rechtzeitig bekannt.',
      sizeAdvice:
        'Unsicher bei der Größe? Die Q-Sprecher haben Musterteile zum Anprobieren in der ' +
        'Schule – sprecht sie einfach an oder schreibt im Abichat. Weil alles in einer ' +
        'Sammelbestellung läuft, ist ein Umtausch später nicht möglich.',
      accessHint: 'Den Code findet ihr im Abichat.',
      imprintText: '[Vor dem Livegang ausfüllen – siehe LEGAL_CHECKLIST.md]',
      privacyText: '[Vor dem Livegang ausfüllen – siehe LEGAL_CHECKLIST.md]',
      withdrawalText: '[Vor dem Livegang ausfüllen – siehe LEGAL_CHECKLIST.md]',
      termsText: '[Vor dem Livegang ausfüllen – siehe LEGAL_CHECKLIST.md]',
    },
  });

  for (const seed of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { slug: seed.slug },
      update: {},
      create: {
        slug: seed.slug,
        name: seed.name,
        model: seed.model,
        summary: seed.summary,
        description: seed.description,
        sortOrder: seed.sortOrder,
      },
      select: { id: true, _count: { select: { images: true } } },
    });

    for (const [index, size] of SIZES.entries()) {
      await prisma.productVariant.upsert({
        where: {
          productId_color_size_label: { productId: product.id, color: COLOR, size, label: '' },
        },
        update: {},
        create: {
          productId: product.id,
          color: COLOR,
          size,
          label: '',
          priceCents: seed.priceCents,
          sortOrder: index,
        },
      });
    }

    // Nur beim ersten Lauf – ein erneuter Seed soll keine doppelten Bilder anhängen.
    if (product._count.images === 0) {
      for (const [index, image] of seed.images.entries()) {
        const mediaId = await storeSeedImage(image.file);
        await prisma.productImage.create({
          data: { productId: product.id, mediaId, caption: image.caption, sortOrder: index },
        });
      }
    }
  }

  const productCount = await prisma.product.count();
  const variantCount = await prisma.productVariant.count();
  process.stdout.write(`Seed fertig: ${productCount} Produkte, ${variantCount} Varianten.\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
