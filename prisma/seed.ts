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
/**
 * Design 3 gibt es in genau einer Farbe. Das Modell kann mehr – weitere Farben legt der
 * Adminbereich an, ohne dass hier etwas geaendert werden muss.
 */
const COLORS = ['Navy'];
const PRICE_CENTS = 4490;

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
        'zum Hersteller. Sobald die Lieferung da ist, werden die Hoodies in der Schule bei den ' +
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

  const hoodie = await prisma.product.upsert({
    where: { slug: 'abi-hoodie' },
    update: {},
    create: {
      slug: 'abi-hoodie',
      name: 'Abikropolis Hoodie 2027',
      summary: 'Navyfarbener Hoodie mit Lorbeer-Emblem vorne und dem Abikropolis-Print auf dem Rücken.',
      description:
        'Dicker, angerauter Baumwollmix in tiefem Marineblau, Unisex-Schnitt. Vorne links das ' +
        'Lorbeer-Emblem mit Säule und der Jahreszahl 2027, hinten großflächig der ' +
        'Abikropolis-Schriftzug, der Spruch "Die Götter verlassen den Olymp", die Weinranke ' +
        'und darunter alle Namen des Jahrgangs.\n\n' +
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
