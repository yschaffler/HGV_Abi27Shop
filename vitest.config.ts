import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Zwei Testprojekte:
 *
 *  - unit:        reine Logik, laeuft ohne Datenbank und ohne Netz. Das ist der Grossteil
 *                 der sicherheitskritischen Logik, weil sie bewusst als reine Funktionen
 *                 geschrieben ist (Preisberechnung, Aggregation, CSV, Statusableitung).
 *  - integration: Bestellanlage, Stripe-Webhook, Berechtigungen und Ausgabe gegen eine echte
 *                 Datenbank. Nur damit laesst sich pruefen, was wirklich wichtig ist:
 *                 Transaktionen, Unique-Constraints und gleichzeitige Zugriffe.
 *
 * "npm test" faehrt beide. Ohne TEST_DATABASE_URL bricht das Integrationsprojekt mit einer
 * klaren Meldung ab, statt stillschweigend nichts zu pruefen.
 */

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  // "server-only" wirft ausserhalb der react-server-Condition. In Tests neutralisieren.
  'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: ['tests/setup.ts'],
          restoreMocks: true,
          clearMocks: true,
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/setup.ts', 'tests/integration/database.ts'],
          restoreMocks: true,
          clearMocks: true,
          // Die Testfaelle teilen sich eine Datenbank und raeumen zwischen den Faellen auf.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
