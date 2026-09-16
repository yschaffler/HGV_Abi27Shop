import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';

/**
 * Liveness- und Readiness-Check für Docker und Monitoring.
 *
 * Gibt bewusst keine Versionsnummern, Hostnamen oder Fehlermeldungen preis – nur ok/fehler.
 * Details stehen im Serverlog.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
