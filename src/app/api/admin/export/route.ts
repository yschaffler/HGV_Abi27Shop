import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { recordAudit } from '@/server/audit';
import { authorize } from '@/server/auth/rbac';
import { buildExport } from '@/server/export/exports';
import { logUnexpected } from '@/server/logger';

/**
 * Download der Exporte.
 *
 * Als Route Handler statt Server Action, weil hier eine Datei mit eigenen Headern
 * ausgeliefert wird. Die Berechtigungsprüfung passiert trotzdem serverseitig und
 * unabhängig davon, ob im Frontend ein Button sichtbar ist.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  kind: z.enum(['aggregate', 'details']),
  format: z.enum(['csv', 'xlsx']),
});

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authorize(['ADMIN']);
  if (!auth.ok) {
    // Kein Hinweis darauf, ob die Route existiert oder nur die Rolle fehlt.
    return new NextResponse(null, { status: 404 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    kind: url.searchParams.get('kind'),
    format: url.searchParams.get('format'),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Exportart' }, { status: 400 });
  }

  const limit = checkRateLimit(`export:${auth.user.id}`, RATE_LIMITS.export);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Zu viele Exporte' }, { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } });
  }

  try {
    const result = await buildExport(parsed.data.kind, parsed.data.format);

    await recordAudit({
      actor: auth.user,
      action: 'EXPORT_DOWNLOADED',
      entityType: 'Export',
      entityId: `${parsed.data.kind}.${parsed.data.format}`,
      summary: `Export ${parsed.data.kind} als ${parsed.data.format} mit ${result.rowCount} Zeilen`,
    });

    return new NextResponse(new Uint8Array(result.body), {
      status: 200,
      headers: {
        'content-type': result.contentType,
        'content-length': String(result.body.byteLength),
        // Der Dateiname wird serverseitig gebildet und enthält keine Nutzereingaben.
        'content-disposition': `attachment; filename="${result.filename}"`,
        'x-content-type-options': 'nosniff',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const errorId = logUnexpected('adminExport', error, { kind: parsed.data.kind, format: parsed.data.format });
    return NextResponse.json({ error: 'Export fehlgeschlagen', errorId }, { status: 500 });
  }
}
