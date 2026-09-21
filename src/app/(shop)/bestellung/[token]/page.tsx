import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CircleCheckIcon, CircleAlertIcon, LoaderCircleIcon, MapPinIcon } from 'lucide-react';
import { DistributionStatusBadge, PaymentStatusBadge } from '@/components/shop/order-status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { OrderPageEffects } from '@/components/shop/order-page-effects';
import { formatCents } from '@/lib/money';
import { publicTokenSchema } from '@/lib/validation/order';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { clientIp } from '@/server/request-context';
import { findOrderByPublicToken } from '@/server/shop/order';
import { getSettings } from '@/server/settings';

/**
 * Bestellstatus für den Besteller.
 *
 * Der Token in der URL ist das einzige Zugangsmerkmal – 256 Bit Zufall, nicht erratbar und
 * nicht hochzählbar. Es gibt bewusst keinen Zugriff über die Bestellnummer: die steht auf
 * Listen und wird vorgelesen, sie taugt nicht als Geheimnis.
 *
 * Die Seite setzt NIEMALS einen Zahlungsstatus. Sie zeigt nur an, was der signaturgeprüfte
 * Stripe-Webhook in der Datenbank hinterlegt hat.
 */

export const metadata: Metadata = { title: 'Deine Bestellung', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrderPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;

  const parsedToken = publicTokenSchema.safeParse(token);
  if (!parsedToken.success) notFound();

  // Bremst das Durchprobieren von Tokens zusätzlich ab – rechnerisch aussichtslos ist es ohnehin.
  const ip = await clientIp();
  const limit = checkRateLimit(`order-lookup:${ip}`, RATE_LIMITS.orderLookup);
  if (!limit.allowed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl">Zu viele Anfragen</h1>
        <p className="text-muted-foreground mt-2">Bitte versuche es in ein paar Minuten noch einmal.</p>
      </div>
    );
  }

  const [order, settings] = await Promise.all([findOrderByPublicToken(parsedToken.data), getSettings()]);
  if (!order) notFound();

  const cameFromPayment = query['zahlung'] === 'erfolgreich';
  const awaitingPayment = order.paymentStatus === 'PENDING' && cameFromPayment;
  const cancelled = query['zahlung'] === 'abgebrochen';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <OrderPageEffects paid={order.paymentStatus === 'PAID'} awaitingPayment={awaitingPayment} />

      {awaitingPayment ? (
        <Alert variant="warning" className="mb-6">
          <LoaderCircleIcon aria-hidden="true" />
          <AlertTitle>Zahlung wird bestätigt …</AlertTitle>
          <AlertDescription>
            <p>
              Das dauert normalerweise nur wenige Sekunden. Die Seite aktualisiert sich
              automatisch. Der Status wird ausschließlich von unserem Zahlungsdienstleister
              bestätigt.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {cancelled && order.paymentStatus === 'PENDING' ? (
        <Alert variant="warning" className="mb-6">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>Zahlung abgebrochen</AlertTitle>
          <AlertDescription>
            <p>
              Die Bestellung ist gespeichert, aber noch nicht bezahlt. Bitte lege sie neu an, wenn
              du sie doch möchtest.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {order.paymentStatus === 'PAID' ? (
        <Alert variant="info" className="mb-6">
          <CircleCheckIcon aria-hidden="true" />
          <AlertTitle>Zahlung eingegangen – vielen Dank!</AlertTitle>
          <AlertDescription>
            <p>Eine Bestellbestätigung ist an {order.email} unterwegs.</p>
          </AlertDescription>
        </Alert>
      ) : null}

      <header className="mb-6">
        <p className="text-muted-foreground text-sm">Bestellnummer</p>
        <h1 className="font-mono text-2xl tracking-wide sm:text-3xl">{order.orderNumber}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <PaymentStatusBadge status={order.paymentStatus} />
          {order.paymentStatus === 'PAID' ? <DistributionStatusBadge status={order.distributionStatus} /> : null}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Bestelldaten</CardTitle>
        </CardHeader>
        <CardContent>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="text-foreground">{order.firstName} {order.lastName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Kurs oder Klasse</dt>
            <dd className="text-foreground">{order.className}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">E-Mail</dt>
            <dd className="text-foreground break-all">{order.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Bestellt am</dt>
            <dd className="text-foreground">
              {new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(order.createdAt)} Uhr
            </dd>
          </div>
        </dl>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Artikel</CardTitle>
        </CardHeader>
        <CardContent>
        <ul className="space-y-3">
          {order.items.map((item) => (
            <li key={item.id} className="border-border flex flex-wrap justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
              <div>
                <p className="text-foreground font-medium">
                  {item.quantity} × {item.productName}
                </p>
                <p className="text-muted-foreground text-sm">{item.variantLabel}</p>
                {item.distributionStatus === 'DISTRIBUTED' ? (
                  <Badge variant="success" className="mt-1.5">
                    Ausgegeben
                  </Badge>
                ) : null}
              </div>
              <p className="text-foreground font-semibold">{formatCents(item.lineTotalCents)}</p>
            </li>
          ))}
        </ul>

        <Separator className="my-4" />

        <p className="text-foreground flex justify-between text-base font-semibold">
          <span>Gesamt</span>
          <span className="tabular-nums">{formatCents(order.totalCents)}</span>
        </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPinIcon className="size-4" aria-hidden="true" />
            Abholung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm whitespace-pre-line">{settings.pickupInfo}</p>
          <p className="text-muted-foreground mt-3 text-sm">
            Dein Pulli ist Teil der Sammelbestellung der Q13. Ausgegeben wird erst, wenn die
            gesamte Lieferung da ist.
          </p>
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-6 text-xs">
        Der Link zu dieser Seite ist persönlich. Wer ihn hat, sieht deine Bestellung – bitte nicht weitergeben.
      </p>
    </div>
  );
}
