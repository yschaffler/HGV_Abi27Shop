'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { CircleAlertIcon, MapPinIcon, UsersIcon } from 'lucide-react';
import { useCart } from '@/components/use-cart';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { formatCents } from '@/lib/money';
import {
  resolveCartAction,
  submitCheckoutAction,
  type CartViewState,
  type CheckoutFormState,
} from '@/app/(shop)/actions';

const INITIAL_STATE: CheckoutFormState = { status: 'idle' };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="xl" disabled={disabled || pending} className="w-full">
      {pending ? 'Weiterleitung zur Zahlung …' : 'Zahlungspflichtig bestellen'}
    </Button>
  );
}

/**
 * Bestätigungsfeld.
 *
 * Radix-Checkbox statt <input type="checkbox">: Das native Feld lässt sich nicht zuverlässig
 * gestalten. Radix rendert deshalb einen Button und schiebt ein verstecktes Eingabefeld
 * daneben, das den Wert an das Formular weitergibt – auch bei einem klassischen POST ohne
 * JavaScript im Spiel. Die Pflicht wird ohnehin serverseitig geprüft.
 */
function ConfirmationField({
  id,
  error,
  children,
  className,
}: {
  id: string;
  error?: string | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <Checkbox id={id} name={id} required aria-invalid={Boolean(error)} className="mt-0.5" />
        {/*
          Label ist bei shadcn/ui ein Flex-Container – sinnvoll fuer "Icon + ein Wort",
          hier falsch: Jedes Wort und jeder Link wuerde zu einer eigenen Spalte. Deshalb
          zurueck auf normalen Textfluss.
        */}
        <Label htmlFor={id} className="text-muted-foreground block text-sm leading-relaxed font-normal">
          {children}
        </Label>
      </div>
      {error ? <p className="text-destructive mt-2 text-sm font-medium">{error}</p> : null}
    </div>
  );
}

export function CheckoutForm({ pickupInfo }: { pickupInfo: string }) {
  const { items, ready } = useCart();
  const [cart, setCart] = useState<CartViewState | null>(null);
  const [, startTransition] = useTransition();
  const [state, formAction] = useActionState(submitCheckoutAction, INITIAL_STATE);

  useEffect(() => {
    if (!ready) return;
    startTransition(async () => setCart(await resolveCartAction(items)));
  }, [items, ready]);

  if (!ready || cart === null) return <p className="text-muted-foreground">Wird geladen …</p>;

  if (!cart.ok || cart.lines.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-foreground text-lg font-semibold">Der Warenkorb ist leer</p>
          <Button asChild className="mt-5">
            <Link href="/">Zum Hoodie</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <form action={formAction}>
        <Card>
          <CardContent className="space-y-6">
            {/*
              Der Warenkorb wird als IDs und Mengen mitgeschickt. Preise stehen hier bewusst
              nicht drin – der Server berechnet sie neu aus der Datenbank.
            */}
            <input type="hidden" name="items" value={JSON.stringify(items)} />

            {state.status === 'error' && state.message ? (
              <Alert variant="destructive">
                <CircleAlertIcon aria-hidden="true" />
                <AlertDescription>
                  <p>{state.message}</p>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName" className="mb-1.5">
                  Vorname
                </Label>
                <Input
                  id="firstName"
                  name="firstName"
                  required
                  maxLength={80}
                  autoComplete="given-name"
                  aria-invalid={Boolean(fieldErrors.firstName)}
                />
                {fieldErrors.firstName ? (
                  <p className="text-destructive mt-1 text-sm font-medium">{fieldErrors.firstName}</p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="lastName" className="mb-1.5">
                  Nachname
                </Label>
                <Input
                  id="lastName"
                  name="lastName"
                  required
                  maxLength={80}
                  autoComplete="family-name"
                  aria-invalid={Boolean(fieldErrors.lastName)}
                />
                {fieldErrors.lastName ? (
                  <p className="text-destructive mt-1 text-sm font-medium">{fieldErrors.lastName}</p>
                ) : null}
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="mb-1.5">
                E-Mail-Adresse
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                maxLength={180}
                autoComplete="email"
                aria-invalid={Boolean(fieldErrors.email)}
              />
              <p className="text-muted-foreground mt-1 text-xs">Hierhin geht die Bestellbestätigung.</p>
              {fieldErrors.email ? (
                <p className="text-destructive mt-1 text-sm font-medium">{fieldErrors.email}</p>
              ) : null}
            </div>

            <Separator />

            {/*
              Zwei getrennte Häkchen. Das zweite ist der Punkt, an dem erfahrungsgemäß die
              meisten Rückfragen entstehen ("Wann kommt mein Paket?") – deshalb steht es nicht
              im Kleingedruckten, sondern hervorgehoben und einzeln zu bestätigen.
            */}
            <ConfirmationField
              id="acceptedTerms"
              error={fieldErrors.acceptedTerms}
              className="border-border rounded-lg border p-4"
            >
              Ich habe die{' '}
              <Link href="/rechtliches/datenschutz" className="text-primary underline" target="_blank">
                Datenschutzhinweise
              </Link>
              , die{' '}
              <Link href="/rechtliches/agb" className="text-primary underline" target="_blank">
                Bedingungen
              </Link>{' '}
              und die{' '}
              <Link href="/rechtliches/widerruf" className="text-primary underline" target="_blank">
                Widerrufsinformationen
              </Link>{' '}
              gelesen und bestelle kostenpflichtig.
            </ConfirmationField>

            <ConfirmationField
              id="acceptedPickup"
              error={fieldErrors.acceptedPickup}
              className="border-gold-500/60 bg-gold-500/10 rounded-lg border p-4"
            >
              <span>
                <span className="text-foreground font-semibold">
                  Sammelbestellung, kein Versand.
                </span>{' '}
                Mir ist bekannt, dass der Hoodie gemeinsam mit dem gesamten Jahrgang bestellt und
                in der Schule bei den Q-Sprechern abgeholt werden muss – er wird nicht verschickt.
              </span>
            </ConfirmationField>

            <SubmitButton disabled={cart.lines.length === 0} />

            <p className="text-muted-foreground text-xs">
              Die Zahlung läuft über Stripe. Zahlungsdaten werden ausschließlich dort verarbeitet
              und niemals in diesem Shop gespeichert.
            </p>
          </CardContent>
        </Card>
      </form>

      <aside className="h-fit lg:sticky lg:top-20">
        <Card>
          <CardHeader>
            <CardTitle>Deine Bestellung</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {cart.lines.map((line) => (
                <li key={line.variantId} className="flex justify-between gap-3">
                  <span>
                    <span className="text-foreground font-medium">
                      {line.quantity} × {line.productName}
                    </span>
                    <br />
                    <span className="text-muted-foreground">{line.variantLabel}</span>
                  </span>
                  <span className="whitespace-nowrap tabular-nums">{formatCents(line.lineTotalCents)}</span>
                </li>
              ))}
            </ul>

            <Separator className="my-4" />

            <p className="text-foreground flex justify-between text-base font-semibold">
              <span>Gesamt</span>
              <span className="tabular-nums">{formatCents(cart.totalCents)}</span>
            </p>

            <div className="text-muted-foreground mt-5 space-y-2 text-xs">
              <p className="flex items-start gap-2">
                <UsersIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Teil der Sammelbestellung der Q13.
              </p>
              <p className="flex items-start gap-2">
                <MapPinIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span className="whitespace-pre-line">{pickupInfo}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
