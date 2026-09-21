/**
 * Setzt den Zugangscode des Shops von der Kommandozeile.
 *
 * Gedacht fuer die Erstinbetriebnahme und fuer den Fall, dass niemand mehr in den
 * Adminbereich kommt. Im laufenden Betrieb gehoert das in den Adminbereich.
 *
 *   npm run access:code -- ABI27
 *
 * Gespeichert wird nur der Argon2id-Hash; der Code selbst laesst sich danach nicht mehr
 * auslesen.
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import { ARGON2_OPTIONS } from '../src/lib/argon2-params';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL fehlt');

const code = process.argv[2] ?? '';
if (code.length === 0) {
  process.stderr.write(
    'Aufruf: npm run access:code -- <CODE>\n' +
      '(Schranke aufheben: npm run access:code -- --aus)\n',
  );
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

async function main(): Promise<void> {
  if (code === '--aus') {
    await prisma.settings.update({ where: { id: 1 }, data: { accessCodeHash: null } });
    process.stdout.write('Zugangsschranke aufgehoben. Der Shop ist jetzt ohne Code erreichbar.\n');
    return;
  }

  // Dieselbe Normalisierung wie server/shop/access.ts – sonst passt der Code nicht zu sich selbst.
  const normalized = code.replace(/\s+/g, '').toUpperCase();
  if (normalized.length < 4) throw new Error('Der Code muss mindestens 4 Zeichen haben.');

  await prisma.settings.update({
    where: { id: 1 },
    data: { accessCodeHash: await hash(normalized, ARGON2_OPTIONS) },
  });

  process.stdout.write(`Zugangscode gesetzt: ${normalized}\nBestehende Freischaltungen sind damit ungueltig.\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
