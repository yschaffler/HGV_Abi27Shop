import 'server-only';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from './env';

/**
 * Prisma 7 arbeitet mit Driver Adaptern statt mit einer Rust-Engine. Der MariaDB-Adapter
 * spricht das MySQL-Protokoll und ist damit für MySQL 8 wie für MariaDB der richtige.
 *
 * Der Client wird bewusst LAZY erzeugt:
 * `next build` läuft mit NODE_ENV=production, hat aber keine Produktions-Secrets. Würde
 * hier beim Laden des Moduls env() aufgerufen, scheitert schon der Docker-Build. Mit dem
 * Proxy passiert das erst bei der ersten echten Abfrage – also zur Laufzeit, wenn die
 * Konfiguration tatsächlich vorliegt. Ein falsch konfigurierter Container fällt dann
 * sofort beim Healthcheck auf.
 *
 * Pool-Parameter (connectionLimit, connectTimeout, ssl ...) werden als Query-Parameter an
 * DATABASE_URL angehaengt – siehe .env.example. So gibt es genau eine Stelle, an der die
 * Datenbankverbindung konfiguriert wird.
 */

const globalForPrisma = globalThis as unknown as { prismaClient?: PrismaClient };

function createClient(): PrismaClient {
  // Die URL enthält das Datenbankpasswort und darf niemals geloggt werden.
  const adapter = new PrismaMariaDb(env().DATABASE_URL);

  return new PrismaClient({
    adapter,
    log: env().NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prismaClient) {
    globalForPrisma.prismaClient = createClient();
  }
  return globalForPrisma.prismaClient;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property) as unknown;
    // Methoden wie $transaction brauchen den Client als `this`.
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
