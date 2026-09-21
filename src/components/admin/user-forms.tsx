'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { FormFeedback } from '@/components/admin/form-feedback';
import { createUserAction, modifyUserAction, type ActionState } from '@/app/admin/(panel)/actions';

const INITIAL: ActionState = { status: 'idle' };

function SubmitButton({ label, busyLabel, variant = 'primary' }: { label: string; busyLabel: string; variant?: 'primary' | 'secondary' }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={variant === 'primary' ? 'btn-primary' : 'btn-secondary h-9 px-3 text-sm'}>
      {pending ? busyLabel : label}
    </button>
  );
}

export function CreateUserForm() {
  const [state, formAction] = useActionState(createUserAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} successMessage="Benutzer angelegt." />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-name" className="field-label">Name</label>
          <input id="new-name" name="name" required maxLength={80} className="field-input" />
        </div>

        <div>
          <label htmlFor="new-email" className="field-label">E-Mail-Adresse</label>
          <input id="new-email" name="email" type="email" required maxLength={180} autoComplete="off" className="field-input" />
        </div>

        <div>
          <label htmlFor="new-password" className="field-label">Startpasswort (min. 12 Zeichen)</label>
          <input id="new-password" name="password" type="password" required minLength={12} autoComplete="new-password" className="field-input" />
        </div>

        <div>
          <label htmlFor="new-role" className="field-label">Rolle</label>
          <select id="new-role" name="role" defaultValue="DISTRIBUTION" className="field-input">
            <option value="DISTRIBUTION">Ausgabe – nur die Ausgabeansicht</option>
            <option value="ADMIN">Admin – vollständiger Zugriff</option>
          </select>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Admin-Konten richten beim ersten Login zwingend einen zweiten Faktor ein.
        Ausgabe-Konten können das tun, müssen aber nicht – sie bedienen nur die Ausgabeliste.
      </p>

      <SubmitButton label="Benutzer anlegen" busyLabel="Wird angelegt …" />
    </form>
  );
}

export function UserOperationForm({
  userId,
  operation,
  label,
  confirmText,
}: {
  userId: string;
  operation: 'deactivate' | 'activate' | 'reset-totp';
  label: string;
  confirmText?: string;
}) {
  const [state, formAction] = useActionState(modifyUserAction, INITIAL);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
      className="inline-block"
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="operation" value={operation} />
      <SubmitButton label={label} busyLabel="…" variant="secondary" />
      {state.status === 'error' ? <p className="field-error">{state.message}</p> : null}
    </form>
  );
}
