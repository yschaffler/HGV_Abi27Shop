import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CircleAlertIcon } from 'lucide-react';
import { Markdown } from '@/components/markdown';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { stripLeadingHeading } from '@/lib/markdown';
import { getSettings } from '@/server/settings';

/**
 * Rechtstexte.
 *
 * Die Inhalte pflegt der Admin im Adminbereich; sie dürfen Markdown enthalten, damit sich
 * Überschriften, Listen und Links eines Impressums sauber gliedern lassen.
 *
 * Gerendert wird über react-markdown ohne rehype-raw: Es entstehen React-Elemente, kein
 * HTML-String, und rohes HTML im Text bleibt Text. Es gibt weiterhin kein
 * dangerouslySetInnerHTML – über die Einstellungen kommt also kein Skript in den Shop.
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
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <p className="eyebrow text-primary">Rechtliches</p>
      <h1 className="mt-3 mb-8 text-3xl sm:text-4xl">{definition.title}</h1>

      {content.length === 0 || content.startsWith('[Vor dem Livegang') ? (
        <Alert variant="warning">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>Dieser Text ist noch nicht hinterlegt.</AlertTitle>
          <AlertDescription>
            <p>Er muss vor dem Livegang im Adminbereich ausgefüllt und rechtlich geprüft werden.</p>
          </AlertDescription>
        </Alert>
      ) : (
        <Markdown>{stripLeadingHeading(content)}</Markdown>
      )}
    </div>
  );
}
