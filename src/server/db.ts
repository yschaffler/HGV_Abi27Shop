import 'server-only';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from './env';

/**
 * Prisma 7 arbeitet mit Driver Adaptern statt mit einer Rust-Engine. Der MariaDB-Adapter
 * spricht das MySQL-Protokoll und ist damit fuer MySQL 8 wie fuer MariaDB der richtige.
 *
 * Der Adapter bekommt den Connection String unveraendert. Pool-Parameter (connectionLimit,
 * connectTimeout, ssl ...) werden als Query-Parameter an DATABASE_URL angehaengt – siehe
 * .env.example. So gibt es genau eine Stelle, an der die Datenbankverbindung konfiguriert wird.
 *
 * Im Entwicklungsmodus wird die Instanz an globalThis gehaengt, damit Hot Reload nicht bei
 * jedem Speichern einen neuen Connection Pool oeffnet.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // Die URL enthaelt das Datenbankpasswort und darf niemals geloggt werden.
  const adapter = new PrismaMariaDb(env().DATABASE_URL);

  return new PrismaClient({
    adapter,
    log: env().NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (env().NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
