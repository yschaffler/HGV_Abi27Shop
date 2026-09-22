import type { Metadata } from 'next';
import { BroadcastForm } from '@/components/admin/broadcast-form';
import { RetryBroadcastButton } from '@/components/admin/broadcast-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { countRecipients } from '@/server/mail/broadcast';
import { prisma } from '@/server/db';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Rundmail', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Berlin',
});

const AUDIENCE_LABEL: Record<string, string> = {
  PAID: 'Alle bezahlten Bestellungen',
  PAID_NOT_DISTRIBUTED: 'Bezahlt, noch nicht abgeholt',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Vorbereitet',
  SENDING: 'Wird versendet',
  SENT: 'Versendet',
  FAILED: 'Mit Fehlern',
};

export default async function BroadcastPage() {
  const [paidCount, openCount, broadcasts, settings] = await Promise.all([
    countRecipients('PAID'),
    countRecipients('PAID_NOT_DISTRIBUTED'),
    prisma.broadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { createdBy: { select: { name: true } } },
    }),
    getSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Rundmail</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Eine Nachricht an alle Besteller – zum Beispiel, wann und wo die Hoodies abgeholt
          werden können. Der Text geht als Klartext raus; jede Mail bekommt automatisch die
          Anrede mit Vornamen, die Bestellnummer und den persönlichen Link zur Bestellung.
        </p>
      </div>

      <BroadcastForm
        paidCount={paidCount}
        openCount={openCount}
        shopName={settings.shopName}
      />

      <Card>
        <CardHeader>
          <CardTitle>Bisher versendet</CardTitle>
        </CardHeader>
        <CardContent>
          {broadcasts.length === 0 ? (
            <p className="text-muted-foreground text-sm">Es wurde noch keine Rundmail versendet.</p>
          ) : (
            <ul className="space-y-4">
              {broadcasts.map((broadcast) => (
                <li key={broadcast.id} className="border-border border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-foreground font-medium">{broadcast.subject}</p>
                      <p className="text-muted-foreground mt-0.5 text-sm">
                        {AUDIENCE_LABEL[broadcast.audience] ?? broadcast.audience} ·{' '}
                        {DATE_FORMAT.format(broadcast.createdAt)}
                        {broadcast.createdBy ? ` · ${broadcast.createdBy.name}` : ''}
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm tabular-nums">
                        {broadcast.sentCount} von {broadcast.recipientCount} zugestellt
                        {broadcast.failedCount > 0 ? ` · ${broadcast.failedCount} fehlgeschlagen` : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge
                        variant={
                          broadcast.status === 'SENT'
                            ? 'success'
                            : broadcast.status === 'FAILED'
                              ? 'destructive'
                              : 'neutral'
                        }
                      >
                        {STATUS_LABEL[broadcast.status] ?? broadcast.status}
                      </Badge>

                      {broadcast.status !== 'SENDING' && broadcast.sentCount < broadcast.recipientCount ? (
                        <RetryBroadcastButton broadcastId={broadcast.id} />
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
