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

export function TotpSetupForm({ qrDataUrl, manualKey }: { qrDataUrl: string; manualKey: string }) {
  const [state, formAction] = useActionState(confirmTotpSetupAction, INITIAL);

  if (state.status === 'done') {
    return (
      <div className="surface-card space-y-4 rounded-2xl p-6">
        <h1 className="text-xl">Notfallcodes</h1>
        <p className="text-sm">
          Diese Codes werden <strong>nur jetzt</strong> angezeigt. Druck sie aus oder schreib sie ab und
          bewahre sie sicher auf. Jeder Code funktioniert genau einmal – damit kommst du auch ohne
          Handy wieder rein.
        </p>

        <ul className="bg-surface-muted grid grid-cols-2 gap-2 rounded-lg p-3 font-mono text-sm">
          {state.recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>

        <a href="/admin" className="btn-primary h-11 w-full">
          Weiter zum Adminbereich
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="surface-card space-y-4 rounded-2xl p-6">
      <div>
        <h1 className="text-xl">Zwei-Faktor einrichten</h1>
        <p className="text-muted mt-1 text-sm">
          Für Admin-Konten ist ein zweiter Faktor Pflicht. Scanne den Code mit einer
          Authenticator-App (z. B. Aegis, 2FAS, Google Authenticator).
        </p>
      </div>

      {/* Der QR-Code wird serverseitig erzeugt und als data:-URL eingebettet – kein externer Dienst. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrDataUrl}
        alt="QR-Code zur Einrichtung der Zwei-Faktor-Authentifizierung"
        className="mx-auto size-48 rounded-lg bg-white p-2"
      />

      <details className="text-muted text-sm">
        <summary className="cursor-pointer">Kamera geht nicht? Schlüssel manuell eingeben</summary>
        <code className="mt-2 block break-all font-mono text-xs">{manualKey}</code>
      </details>

      {state.status === 'error' && state.message ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
          {state.message}
        </p>
      ) : null}

      <div>
        <label htmlFor="code" className="field-label">Code aus der App</label>
        <input
          id="code"
          name="code"
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          className="field-input text-center font-mono text-lg tracking-widest"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
