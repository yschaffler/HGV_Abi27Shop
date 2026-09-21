'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { verifyTotpAction, type TotpState } from '@/app/login/actions';

const INITIAL: TotpState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary h-11 w-full">
      {pending ? 'Wird geprüft …' : 'Bestätigen'}
    </button>
  );
}

/**
 * Zweiter Faktor beim Anmelden.
 *
 * Der Wechsel zwischen Authenticator-Code und Notfallcode läuft über einen echten Link mit
 * Query-Parameter statt über einen Umschalter im React-State. Grund: Der Notfallcode ist die
 * Rückfalloption, wenn sonst nichts mehr geht – die darf nicht daran scheitern, dass
 * JavaScript noch nicht geladen ist.
 */
export function TotpForm({ mode }: { mode: 'totp' | 'recovery' }) {
  const [state, formAction] = useActionState(verifyTotpAction, INITIAL);
  const useRecovery = mode === 'recovery';

  return (
    <form action={formAction} className="surface-card space-y-4 rounded-2xl p-6">
      <div>
        <h1 className="text-xl">Zweiter Faktor</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {useRecovery
            ? 'Gib einen deiner Notfallcodes ein. Jeder Code funktioniert nur einmal.'
            : 'Gib den sechsstelligen Code aus deiner Authenticator-App ein.'}
        </p>
      </div>

      {state.status === 'error' && state.message ? (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm font-medium">
          {state.message}
        </p>
      ) : null}

      <input type="hidden" name="modus" value={useRecovery ? 'notfallcode' : 'totp'} />

      <div>
        <label htmlFor="code" className="field-label">
          {useRecovery ? 'Notfallcode' : 'Code'}
        </label>
        <input
          id="code"
          name="code"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode={useRecovery ? 'text' : 'numeric'}
          placeholder={useRecovery ? 'ABCD-EFGH-JKMN' : '123456'}
          className="field-input text-center font-mono text-lg tracking-widest"
        />
      </div>

      <SubmitButton />

      <Link
        href={useRecovery ? '/login/zwei-faktor' : '/login/zwei-faktor?modus=notfallcode'}
        className="text-muted-foreground block text-center text-sm hover:underline"
      >
        {useRecovery ? 'Doch die Authenticator-App verwenden' : 'Authenticator nicht zur Hand? Notfallcode verwenden'}
      </Link>
    </form>
  );
}
