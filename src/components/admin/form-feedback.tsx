import type { ActionState } from '@/app/admin/(panel)/actions';

/** Einheitliche Rückmeldung für alle Admin-Formulare. */
export function FormFeedback({ state, successMessage = 'Gespeichert.' }: { state: ActionState; successMessage?: string }) {
  if (state.status === 'idle') return null;

  if (state.status === 'ok') {
    return (
      <p role="status" className="bg-success-bg text-success-fg rounded-lg px-3 py-2 text-sm font-medium">
        {successMessage}
      </p>
    );
  }

  return (
    <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm font-medium">
      {state.message ?? 'Es ist ein Fehler aufgetreten.'}
    </p>
  );
}
