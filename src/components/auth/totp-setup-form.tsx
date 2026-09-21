'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { confirmTotpSetupAction, type TotpSetupState } from '@/app/login/actions';

const INITIAL: TotpSetupState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary h-11 w-full">
      {pending ? 'Wird geprüft …' : 'Einrichtung abschließen'}
    </button>
  );
}

/**
 * Einrichtung des zweiten Faktors in einem Rutsch: QR-Code scannen, Notfallcodes sichern,
 * Code eingeben.
 *
 * Die Notfallcodes stehen bewusst schon hier und nicht erst nach der Bestätigung – so gehen
 * sie auch dann nicht verloren, wenn das Formular ohne JavaScript abgeschickt wird und die
 * Seite danach neu gerendert wird.
 */
export function TotpSetupForm({
  qrDataUrl,
  manualKey,
  recoveryCodes,
}: {
  qrDataUrl: string;
  manualKey: string;
  recoveryCodes: string[];
}) {
  const [state, formAction] = useActionState(confirmTotpSetupAction, INITIAL);

  return (
    <form action={formAction} className="surface-card space-y-5 rounded-2xl p-6">
      <div>
        <h1 className="text-xl">Zwei-Faktor einrichten</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Für Admin-Konten ist ein zweiter Faktor Pflicht.
        </p>
      </div>

      <section>
        <h2 className="text-foreground text-sm font-semibold">1. QR-Code scannen</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Mit einer Authenticator-App, zum Beispiel Aegis, 2FAS oder Google Authenticator.
        </p>

        {/* Serverseitig erzeugt und als data:-URL eingebettet – kein externer Dienst. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt="QR-Code zur Einrichtung der Zwei-Faktor-Authentifizierung"
          className="mx-auto mt-3 size-48 rounded-lg bg-white p-2"
        />

        <details className="text-muted-foreground mt-2 text-sm">
          <summary className="cursor-pointer">Kamera geht nicht? Schlüssel manuell eingeben</summary>
          <code className="mt-2 block font-mono text-xs break-all">{manualKey}</code>
        </details>
      </section>

      <section>
        <h2 className="text-foreground text-sm font-semibold">2. Notfallcodes sichern</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Damit kommst du auch ohne Handy wieder rein. Jeder Code funktioniert genau einmal.
          Ausdrucken oder abschreiben und sicher aufbewahren.
        </p>

        <ul className="bg-muted mt-3 grid grid-cols-2 gap-2 rounded-lg p-3 font-mono text-sm">
          {recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>

        <p className="text-muted-foreground mt-2 text-xs">
          Nach dem Abschluss der Einrichtung lassen sich diese Codes nicht erneut anzeigen –
          gespeichert bleiben dann nur noch Prüfsummen.
        </p>

        {/*
          Natives `required` statt einer Sperre über React-State: Der Browser erzwingt das
          Häkchen auch dann, wenn JavaScript nicht geladen hat. Ein Button, der ohne
          JavaScript dauerhaft gesperrt wäre, würde die Einrichtung unmöglich machen.
        */}
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" name="codesGesichert" required className="mt-0.5 size-4 shrink-0" />
          Ich habe die Notfallcodes gesichert.
        </label>
      </section>

      <section>
        <h2 className="text-foreground text-sm font-semibold">3. Code aus der App eingeben</h2>

        {state.status === 'error' && state.message ? (
          <p role="alert" className="mt-2 bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm font-medium">
            {state.message}
          </p>
        ) : null}

        <label htmlFor="code" className="sr-only">Code aus der App</label>
        <input
          id="code"
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          className="field-input mt-2 text-center font-mono text-lg tracking-widest"
        />
      </section>

      <SubmitButton />
    </form>
  );
}
