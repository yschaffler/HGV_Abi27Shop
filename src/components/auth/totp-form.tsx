'use client';

import { useActionState, useState } from 'react';
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

export function TotpForm() {
  const [state, formAction] = useActionState(verifyTotpAction, INITIAL);
  const [useRecovery, setUseRecovery] = useState(false);

  return (
    <form action={formAction} className="surface-card space-y-4 rounded-2xl p-6">
      <div>
        <h1 className="text-xl">Zweiter Faktor</h1>
        <p className="text-muted mt-1 text-sm">
          {useRecovery
            ? 'Gib einen deiner Notfallcodes ein. Jeder Code funktioniert nur einmal.'
            : 'Gib den sechsstelligen Code aus deiner Authenticator-App ein.'}
        </p>
      </div>

      {state.status === 'error' && state.message ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
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

      <button
        type="button"
        onClick={() => setUseRecovery((value) => !value)}
        className="text-muted w-full text-sm hover:underline"
      >
        {useRecovery ? 'Doch die Authenticator-App verwenden' : 'Authenticator nicht zur Hand? Notfallcode verwenden'}
      </button>
    </form>
  );
}
