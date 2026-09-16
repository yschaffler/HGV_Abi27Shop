import { NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { authorize, ROLES_WITH_DISTRIBUTION_ACCESS } from '@/server/auth/rbac';
import { logUnexpected } from '@/server/logger';
import { searchPaidOrders, SEARCH_MIN_LENGTH } from '@/server/shop/distribution';

/**
 * Autocomplete für die Ausgabe.
 *
 * Als GET-Route statt Server Action, weil das Suchfeld bei jedem Tastendruck feuert und
 * laufende Anfragen per AbortController abgebrochen werden – dafür ist ein normaler
 * fetch die passende Form.
 *
 * Es werden ausschließlich bezahlte Bestellungen gefunden: Was nicht bezahlt ist,
 * wird auch nicht ausgegeben.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authorize(ROLES_WITH_DISTRIBUTION_ACCESS);
  if (!auth.ok) return new NextResponse(null, { status: 404 });

  const limit = checkRateLimit(`distribution-search:${auth.user.id}`, RATE_LIMITS.distributionSearch);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen' },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
    );
  }

  const query = new URL(request.url).searchParams.get('q') ?? '';
  if (query.trim().length < SEARCH_MIN_LENGTH) {
    return NextResponse.json({ results: [] }, { headers: { 'cache-control': 'no-store' } });
  }

  try {
    const results = await searchPaidOrders(query.slice(0, 80));
    return NextResponse.json({ results }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const errorId = logUnexpected('distributionSearch', error);
    return NextResponse.json({ error: 'Suche fehlgeschlagen', errorId }, { status: 500 });
  }
}
