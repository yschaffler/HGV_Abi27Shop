'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { useCart } from '@/components/use-cart';
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
    <button type="submit" disabled={disabled || pending} className="btn-primary h-12 w-full text-base">
      {pending ? 'Weiterleitung zur Zahlung …' : 'Zahlungspflichtig bestellen'}
    </button>
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

  if (!ready || cart === null) return <p className="text-muted">Wird geladen …</p>;

  if (!cart.ok || cart.lines.length === 0) {
    return (
      <div className="surface-card rounded-2xl px-4 py-12 text-center">
        <p className="text-strong text-lg font-semibold">Der Warenkorb ist leer</p>
        <Link href="/" className="btn-primary mt-5">
          Artikel ansehen
        </Link>
      </div>
    );
  }

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <form action={formAction} className="surface-card space-y-5 rounded-2xl p-5">
        {/*
          Der Warenkorb wird als IDs und Mengen mitgeschickt. Preise stehen hier bewusst nicht
          drin – der Server berechnet sie neu aus der Datenbank.
        */}
        <input type="hidden" name="items" value={JSON.stringify(items)} />

        {state.status === 'error' && state.message ? (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
            {state.message}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="field-label">Vorname</label>
            <input
              id="firstName"
              name="firstName"
              required
              maxLength={80}
              autoComplete="given-name"
              className="field-input"
              aria-invalid={Boolean(fieldErrors.firstName)}
            />
            {fieldErrors.firstName ? <p className="field-error">{fieldErrors.firstName}</p> : null}
          </div>

          <div>
            <label htmlFor="lastName" className="field-label">Nachname</label>
            <input
              id="lastName"
              name="lastName"
              required
              maxLength={80}
              autoComplete="family-name"
              className="field-input"
              aria-invalid={Boolean(fieldErrors.lastName)}
            />
            {fieldErrors.lastName ? <p className="field-error">{fieldErrors.lastName}</p> : null}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="field-label">E-Mail-Adresse</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={180}
            autoComplete="email"
            className="field-input"
            aria-invalid={Boolean(fieldErrors.email)}
          />
          <p className="text-muted mt-1 text-xs">Hierhin geht die Bestellbestätigung.</p>
          {fieldErrors.email ? <p className="field-error">{fieldErrors.email}</p> : null}
        </div>

        <div>
          <label htmlFor="className" className="field-label">Klasse</label>
          <input
            id="className"
            name="className"
            required
            maxLength={20}
            placeholder="z. B. 13B"
            className="field-input sm:max-w-40"
            aria-invalid={Boolean(fieldErrors.className)}
          />
          {fieldErrors.className ? <p className="field-error">{fieldErrors.className}</p> : null}
        </div>

        <div className="border-line rounded-lg border p-4">
          <label htmlFor="acceptedTerms" className="flex items-start gap-3 text-sm">
            <input
              id="acceptedTerms"
              name="acceptedTerms"
              type="checkbox"
              required
              className="mt-0.5 size-4 shrink-0"
            />
            <span>
              Ich habe die{' '}
              <Link href="/rechtliches/datenschutz" className="underline" target="_blank">Datenschutzhinweise</Link>,{' '}
              die <Link href="/rechtliches/agb" className="underline" target="_blank">Bedingungen</Link> und die{' '}
              <Link href="/rechtliches/widerruf" className="underline" target="_blank">Widerrufsinformationen</Link>{' '}
              gelesen und bestelle kostenpflichtig.
            </span>
          </label>
          {fieldErrors.acceptedTerms ? <p className="field-error">{fieldErrors.acceptedTerms}</p> : null}
        </div>

        <SubmitButton disabled={cart.lines.length === 0} />

        <p className="text-muted text-xs">
          Die Zahlung läuft über Stripe. Zahlungsdaten werden ausschließlich dort verarbeitet
          und niemals in diesem Shop gespeichert.
        </p>
      </form>

      <aside className="surface-card h-fit rounded-2xl p-5 lg:sticky lg:top-20">
        <h2 className="text-lg">Deine Bestellung</h2>
        <ul className="border-line mt-4 space-y-3 border-b pb-4 text-sm">
          {cart.lines.map((line) => (
            <li key={line.variantId} className="flex justify-between gap-3">
              <span>
                <span className="text-strong font-medium">{line.quantity} × {line.productName}</span>
                <br />
                <span className="text-muted">{line.variantLabel}</span>
              </span>
              <span className="whitespace-nowrap">{formatCents(line.lineTotalCents)}</span>
            </li>
          ))}
        </ul>

        <p className="text-strong mt-4 flex justify-between text-base font-semibold">
          <span>Gesamt</span>
          <span>{formatCents(cart.totalCents)}</span>
        </p>

        <h3 className="text-strong mt-5 text-sm font-semibold">Abholung</h3>
        <p className="text-muted mt-1 text-xs whitespace-pre-line">{pickupInfo}</p>
      </aside>
    </div>
  );
}
