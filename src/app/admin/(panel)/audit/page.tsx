import type { Metadata } from 'next';
import { prisma } from '@/server/db';

export const metadata: Metadata = { title: 'Protokoll', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Europe/Berlin',
});

/**
 * Audit-Log.
 *
 * Datensparsam: Akteur, Aktion, betroffene Entität und eine kurze Zusammenfassung.
 * Keine IP-Adressen, keine Request-Inhalte, keine Kontaktdaten von Bestellern.
 */
export default async function AuditPage() {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      createdAt: true,
      actorEmail: true,
      action: true,
      entityType: true,
      entityId: true,
      summary: true,
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl">Protokoll</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Die letzten 200 sicherheits- und geldrelevanten Aktionen.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground surface-card rounded-xl px-4 py-10 text-center">Noch keine Einträge.</p>
      ) : (
        <div className="surface-card overflow-x-auto rounded-xl">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="border-border text-muted-foreground border-b text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Zeit</th>
                <th className="px-4 py-3 font-medium">Akteur</th>
                <th className="px-4 py-3 font-medium">Aktion</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-border border-b last:border-0">
                  <td className="text-muted-foreground px-4 py-2.5 whitespace-nowrap">{DATE_FORMAT.format(entry.createdAt)}</td>
                  <td className="px-4 py-2.5 break-all">{entry.actorEmail}</td>
                  <td className="text-foreground px-4 py-2.5 font-mono text-xs">{entry.action}</td>
                  <td className="px-4 py-2.5">{entry.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
