'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { CreditCardIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resumePaymentAction, type ResumePaymentState } from '@/app/(shop)/actions';

const INITIAL_STATE: ResumePaymentState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending}>
      <CreditCardIcon aria-hidden="true" />
      {pending ? 'Weiterleitung zur Zahlung …' : 'Jetzt bezahlen'}
    </Button>
  );
}

/**
 * Zahlung zu einer offenen Bestellung nachholen.
 *
 * Der Token steht in einem versteckten Feld statt im Zustand der Komponente – damit
 * funktioniert das Formular auch, bevor JavaScript geladen ist.
 */
export function ResumePaymentForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resumePaymentAction, INITIAL_STATE);

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <SubmitButton />

      {state.status === 'error' && state.message ? (
        <p role="alert" className="text-destructive mt-3 text-sm font-medium">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
