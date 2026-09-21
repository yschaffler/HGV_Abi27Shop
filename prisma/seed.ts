/**
 * Beispieldaten für die Entwicklung und den ersten Aufbau.
 *
 * Idempotent: mehrfaches Ausführen erzeugt keine Duplikate. Legt bewusst KEINEN
 * Admin-Benutzer an – dafür gibt es scripts/create-admin.ts mit einem echten Passwort.
 *
 * Es wird genau ein Produkt angelegt, weil der Shop auf genau einen Artikel ausgelegt ist.
 * Das Datenmodell könnte mehr, aber die Startseite inszeniert den Hoodie – und die
 * Entwicklungsdaten sollen zeigen, was am Ende auch live steht.
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL fehlt');

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const COLORS = ['Schwarz', 'Dunkelblau', 'Creme', 'Weiss'];
const PRICE_CENTS = 4490;

async function main(): Promise<void> {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      shopName: 'Abikropolis 2027',
      contactEmail: 'abi2027@example.de',
      orderStartAt: new Date('2026-09-20T10:00:00Z'),
      orderEndAt: new Date('2026-10-04T21:59:00Z'),
      pickupInfo:
        'Die gesamte Q13 bestellt gemeinsam: Nach dem Bestellschluss geht ein einziger Auftrag ' +
        'zum Hersteller. Sobald die Lieferung da ist, werden die Hoodies in der Schule bei den ' +
        'Q-Sprechern ausgegeben. Es gibt keinen Versand. Den genauen Ausgabetermin geben wir ' +
        'rechtzeitig bekannt.',
      accessHint: 'Den Code findet ihr im Abichat.',
      imprintText: '[Vor dem Livegang ausfüllen – siehe LEGAL_CHECKLIST.md]',
      privacyText: '[Vor dem Livegang ausfüllen – siehe LEGAL_CHECKLIST.md]',
      withdrawalText: '[Vor dem Livegang ausfüllen – siehe LEGAL_CHECKLIST.md]',
      termsText: '[Vor dem Livegang ausfüllen – siehe LEGAL_CHECKLIST.md]',
    },
  });

  const hoodie = await prisma.product.upsert({
    where: { slug: 'abi-hoodie' },
    update: {},
    create: {
      slug: 'abi-hoodie',
      name: 'Abikropolis Hoodie 2027',
      summary: 'Schwerer Hoodie mit dem Abikropolis-Motiv auf dem Rücken.',
      description:
        'Dicker, angerauter Baumwollmix im Unisex-Schnitt. Vorne der kleine Jahrgangsprint, ' +
        'hinten großflächig das Abikropolis-Motiv mit der Jahreszahl 2027.\n\n' +
        'Die Q13 bestellt gemeinsam als Sammelbestellung. Der Hoodie fällt normal aus; wer es ' +
        'lockerer mag, nimmt eine Größe größer – umtauschen ist danach nicht möglich.',
      sortOrder: 10,
    },
  });

  const variants: Array<{
    productId: string;
    color: string;
    size: string;
    label: string;
    priceCents: number;
    sortOrder: number;
  }> = [];

  COLORS.forEach((color, colorIndex) => {
    SIZES.forEach((size, sizeIndex) => {
      variants.push({
        productId: hoodie.id,
        color,
        size,
        label: '',
        priceCents: PRICE_CENTS,
        sortOrder: colorIndex * 100 + sizeIndex,
      });
    });
  });

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
