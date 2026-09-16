import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, beforeEach } from 'vitest';

/**
 * Datenbank fuer die Integrationstests.
 *
 * Zwei Sicherungen, damit hier niemals versehentlich eine echte Datenbank geleert wird:
 *  1. TEST_DATABASE_URL muss gesetzt sein – es gibt keinen stillen Rueckfall.
 *  2. Der Datenbankname muss "test" enthalten.
 *
 * Diese Datei laeuft als Setup-Datei, also bevor die Testdateien ihre Module importieren.
 * Nur deshalb kann sie DATABASE_URL noch wirksam umbiegen.
 */

const testDatabaseUrl = process.env['TEST_DATABASE_URL'];

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL ist nicht gesetzt.\n' +
      'Die Integrationstests brauchen eine eigene Datenbank, zum Beispiel:\n' +
      '  TEST_DATABASE_URL="mysql://abishop:devpass@127.0.0.1:3306/abishop_test" npm test\n' +
      'Mit "docker compose up -d db" steht eine passende Datenbank bereit.',
  );
}

const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\//, '');
if (!databaseName.includes('test')) {
  throw new Error(
    `Die Testdatenbank heisst "${databaseName}" und enthaelt nicht "test". ` +
      'Aus Sicherheitsgruenden wird hier nichts geleert.',
  );
}

process.env['DATABASE_URL'] = testDatabaseUrl;

/**
 * Reihenfolge beachten: Kindtabellen zuerst, sonst blockieren die Fremdschluessel.
 *
 * Bewusst DELETE statt TRUNCATE: TRUNCATE laesst sich bei bestehenden Fremdschluesseln nicht
 * ausfuehren, und `SET FOREIGN_KEY_CHECKS = 0` wirkt nur auf der Verbindung, auf der es
 * abgesetzt wurde – der Pool verteilt die Anweisungen aber auf mehrere Verbindungen.
 * Bei Testdatenmengen ist DELETE ohnehin schnell genug.
 */
const TABLES = [
  'audit_logs',
  'stripe_webhook_events',
  'order_items',
  'orders',
  'product_variants',
  'products',
  'recovery_codes',
  'sessions',
  'media_assets',
  'users',
  'settings',
];

beforeAll(() => {
  // Schema auf den aktuellen Stand bringen. Idempotent – ein zweiter Lauf tut nichts.
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  });
});

beforeEach(async () => {
  const { prisma } = await import('@/server/db');

  for (const table of TABLES) {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\``);
  }
});

afterAll(async () => {
  const { prisma } = await import('@/server/db');
  await prisma.$disconnect();
});
