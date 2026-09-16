/**
 * Beispieldaten für die Entwicklung und den ersten Aufbau.
 *
 * Idempotent: mehrfaches Ausführen erzeugt keine Duplikate. Legt bewusst KEINEN
 * Admin-Benutzer an – dafür gibt es scripts/create-admin.ts mit einem echten Passwort.
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL fehlt');

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

async function main(): Promise<void> {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      shopName: 'Abi-Shop 2027',
      contactEmail: 'abi2027@example.de',
      orderStartAt: new Date('2026-09-20T10:00:00Z'),
      orderEndAt: new Date('2026-10-04T21:59:00Z'),
      pickupInfo:
        'Die Artikel werden gesammelt beim Hersteller bestellt und anschließend in der Schule ' +
        'an einem zentralen Ausgabepunkt verteilt. Es gibt keinen Versand. Den Ausgabetermin ' +
        'geben wir rechtzeitig bekannt.',
      imprintText: '[Vor dem Livegang ausfüllen – siehe LEGAL_CHECKLIST.md]',
      privacyText: '[Vor dem Livegang ausfüllen – siehe LEGAL_CHECKLIST.md]',
      withdrawalText: '[Vor dem Livegang ausfüllen – siehe LEGAL_CHECKLIST.md]',
      termsText: '[Vor dem Livegang ausfüllen – siehe LEGAL_CHECKLIST.md]',
    },
  });

  const pullover = await prisma.product.upsert({
    where: { slug: 'abipulli' },
    update: {},
    create: {
      slug: 'abipulli',
      name: 'Abipulli',
      summary: 'Schwerer Hoodie mit Abi-Motiv und Namensliste auf dem Rücken.',
      description:
        'Unser Klassiker: dicker Baumwoll-Hoodie mit gesticktem Abi-Logo auf der Brust und ' +
        'der Namensliste des Jahrgangs auf dem Rücken. Fällt normal aus.',
      sortOrder: 10,
    },
  });

  const shirt = await prisma.product.upsert({
    where: { slug: 'abi-shirt' },
    update: {},
    create: {
      slug: 'abi-shirt',
      name: 'Abi-Shirt',
      summary: 'Leichtes T-Shirt im gleichen Design wie der Pulli.',
      description: 'Klassisches T-Shirt aus Bio-Baumwolle, gleiches Motiv wie der Abipulli.',
      sortOrder: 20,
    },
  });

  const newspaper = await prisma.product.upsert({
    where: { slug: 'abi-zeitung' },
    update: {},
    create: {
      slug: 'abi-zeitung',
      name: 'Abi-Zeitung',
      summary: 'Die gedruckte Abi-Zeitung des Jahrgangs.',
      description: 'Rund 120 Seiten Steckbriefe, Umfragen, Lehrerzitate und Bilder. Vollfarbdruck.',
      sortOrder: 30,
    },
  });

  const variants: Array<{ productId: string; color: string; size: string; label: string; priceCents: number; sortOrder: number }> = [];

  SIZES.forEach((size, index) => {
    variants.push({ productId: pullover.id, color: 'Schwarz', size, label: '', priceCents: 3990, sortOrder: index });
    variants.push({ productId: pullover.id, color: 'Bordeaux', size, label: '', priceCents: 3990, sortOrder: 10 + index });
    variants.push({ productId: shirt.id, color: 'Schwarz', size, label: '', priceCents: 1990, sortOrder: index });
  });

  variants.push({ productId: newspaper.id, color: '', size: '', label: 'Standard', priceCents: 1500, sortOrder: 0 });

  for (const variant of variants) {
    await prisma.productVariant.upsert({
      where: {
        productId_color_size_label: {
          productId: variant.productId,
          color: variant.color,
          size: variant.size,
          label: variant.label,
        },
      },
      update: {},
      create: variant,
    });
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
