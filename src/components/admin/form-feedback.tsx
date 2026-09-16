import type { ActionState } from '@/app/admin/(panel)/actions';

/** Einheitliche Rückmeldung für alle Admin-Formulare. */
export function FormFeedback({ state, successMessage = 'Gespeichert.' }: { state: ActionState; successMessage?: string }) {
  if (state.status === 'idle') return null;

  if (state.status === 'ok') {
    return (
      <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-200">
        {successMessage}
      </p>
    );
  }

  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
      {state.message ?? 'Es ist ein Fehler aufgetreten.'}
    </p>
  );
}
