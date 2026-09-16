import { NextResponse } from 'next/server';
import { readStoredMedia } from '@/server/media';

/**
 * Auslieferung der Produktbilder.
 *
 * Wichtig sind die Header: Der Content-Type kommt aus der beim Upload per Magic Bytes
 * bestimmten Bildart, `nosniff` verbietet dem Browser, etwas anderes daraus zu machen,
 * und `inline` mit leerem Dateinamen verhindert überraschende Downloads.
 * Zusammen sorgt das dafür, dass eine hochgeladene Datei niemals als HTML oder Skript
 * ausgeführt werden kann.
 */

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return new NextResponse(null, { status: 404 });
  }

  const media = await readStoredMedia(id);
  if (!media) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(media.body), {
    status: 200,
    headers: {
      'content-type': media.mimeType,
      'content-length': String(media.body.byteLength),
      'x-content-type-options': 'nosniff',
      'content-disposition': 'inline',
      'content-security-policy': "default-src 'none'; sandbox",
      // Bilder ändern sich nur, wenn ein neues hochgeladen wird – das bekommt eine neue ID.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
