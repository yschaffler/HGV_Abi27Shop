import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSettings } from '@/server/settings';

/**
 * Rechtstexte.
 *
 * Die Inhalte pflegt der Admin im Adminbereich und sie werden hier als KLARTEXT gerendert.
 * React escaped den Inhalt automatisch – es gibt kein dangerouslySetInnerHTML, also auch
 * keine Möglichkeit, über die Einstellungen Skripte in den Shop zu bekommen.
 *
 * Die Texte sind Platzhalter, bis sie jemand ausfüllt und rechtlich prüfen lässt.
 * Siehe LEGAL_CHECKLIST.md.
 */

const DOCUMENTS = {
  impressum: { title: 'Impressum', field: 'imprintText' },
  datenschutz: { title: 'Datenschutzerklärung', field: 'privacyText' },
  widerruf: { title: 'Widerrufsbelehrung', field: 'withdrawalText' },
  agb: { title: 'Allgemeine Geschäftsbedingungen', field: 'termsText' },
} as const satisfies Record<string, { title: string; field: 'imprintText' | 'privacyText' | 'withdrawalText' | 'termsText' }>;

type DocumentKey = keyof typeof DOCUMENTS;

type PageProps = { params: Promise<{ doc: string }> };

function isDocumentKey(value: string): value is DocumentKey {
  return Object.hasOwn(DOCUMENTS, value);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { doc } = await params;
  return { title: isDocumentKey(doc) ? DOCUMENTS[doc].title : 'Rechtliches' };
}

export const dynamic = 'force-dynamic';

export default async function LegalPage({ params }: PageProps) {
  const { doc } = await params;
  if (!isDocumentKey(doc)) notFound();

  const definition = DOCUMENTS[doc];
  const settings = await getSettings();
  const content = settings[definition.field].trim();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl sm:text-3xl">{definition.title}</h1>

      {content.length === 0 || content.startsWith('[Vor dem Livegang') ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">Dieser Text ist noch nicht hinterlegt.</p>
          <p className="mt-1">
            Er muss vor dem Livegang im Adminbereich ausgefüllt und rechtlich geprüft werden.
          </p>
        </div>
      ) : (
        <div className="text-normal whitespace-pre-line">{content}</div>
      )}
    </div>
  );
}
