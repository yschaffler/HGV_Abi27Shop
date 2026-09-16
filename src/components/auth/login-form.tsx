'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction, type LoginState } from '@/app/login/actions';

const INITIAL: LoginState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary h-11 w-full">
      {pending ? 'Wird geprüft …' : 'Anmelden'}
    </button>
  );
}

export function LoginForm({ redirectTo, notice }: { redirectTo: string; notice: string | null }) {
  const [state, formAction] = useActionState(loginAction, INITIAL);

  return (
    <form action={formAction} className="surface-card space-y-4 rounded-2xl p-6">
      <div>
        <h1 className="text-xl">Anmeldung</h1>
        <p className="text-muted mt-1 text-sm">Nur für Team und Ausgabe.</p>
      </div>

      {notice ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {notice}
        </p>
      ) : null}

      {state.status === 'error' && state.message ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
          {state.message}
        </p>
      ) : null}

      <input type="hidden" name="weiter" value={redirectTo} />

      <div>
        <label htmlFor="email" className="field-label">E-Mail-Adresse</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          className="field-input"
        />
      </div>

      <div>
        <label htmlFor="password" className="field-label">Passwort</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="field-input"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
