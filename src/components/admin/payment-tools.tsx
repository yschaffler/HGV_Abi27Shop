'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { FormFeedback } from '@/components/admin/form-feedback';
import {
  catchUpPaymentsAction,
  reconcilePaymentAction,
  sendConfirmationAction,
  type ActionState,
} from '@/app/admin/(panel)/actions';

const INITIAL: ActionState = { status: 'idle' };

function SubmitButton({ idle, pending, primary = false }: { idle: string; pending: string; primary?: boolean }) {
  const { pending: isPending } = useFormStatus();
  return (
    <button type="submit" disabled={isPending} className={primary ? 'btn-primary' : 'btn-secondary'}>
      {isPending ? pending : idle}
    </button>
  );
}

/**
 * Zahlung und Bestätigungsmail einer Bestellung nachholen.
 *
 * Eine einzige Komponente an fester Stelle statt zweier Kästen, die je nach Status
 * erscheinen: Nach einem erfolgreichen Klick ändert sich der Status, die Seite rendert neu –
 * und ein bedingt eingeblendeter Kasten verschwände samt seiner Erfolgsmeldung. So bleibt
 * die Rückmeldung stehen, und daneben steht schon der neue Zustand.
 */
export function PaymentRecoveryPanel({
  orderId,
  paymentStatus,
  hasStripeSession,
  confirmationSentLabel,
}: {
  orderId: string;
  paymentStatus: string;
  hasStripeSession: boolean;
  /** Formatierter Zeitpunkt der Bestätigungsmail oder null, wenn keine rausging. */
  confirmationSentLabel: string | null;
}) {
  const [reconcileState, reconcileAction] = useActionState(reconcilePaymentAction, INITIAL);
  const [mailState, mailAction] = useActionState(sendConfirmationAction, INITIAL);

  const paid = paymentStatus === 'PAID';
  const canReconcile = !paid && paymentStatus !== 'REFUNDED' && hasStripeSession;
  const needsAttention = canReconcile || (paid && !confirmationSentLabel);

  if (!canReconcile && !paid && reconcileState.status === 'idle') return null;

  return (
    <section className={`surface-card rounded-xl p-5 ${needsAttention ? 'border-l-4' : ''}`}>
      <h2 className="text-lg">Zahlung und Bestätigungsmail</h2>

      <form action={reconcileAction} className="mt-3 space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <FormFeedback state={reconcileState} />
        {canReconcile ? (
          <>
            <p className="text-muted-foreground text-sm">
              Hat die Person bezahlt, die Bestellung steht hier aber noch nicht als bezahlt? Dann ist
              die Meldung von Stripe nicht angekommen. Der Abgleich fragt Stripe direkt und bucht nur,
              wenn Stripe die Zahlung bestätigt und der Betrag passt. Die Bestätigungsmail geht danach
              automatisch raus.
            </p>
            <SubmitButton idle="Zahlung bei Stripe prüfen" pending="Frage Stripe …" primary />
          </>
        ) : null}
      </form>

      {paid ? (
        <form action={mailAction} className="mt-3 space-y-3">
          <input type="hidden" name="orderId" value={orderId} />
          <p className="text-sm">
            {confirmationSentLabel ? (
              <span className="text-muted-foreground">Bestätigungsmail versendet am {confirmationSentLabel}.</span>
            ) : (
              <span className="text-foreground font-medium">Die Bestätigungsmail ist nicht rausgegangen.</span>
            )}
          </p>
          <FormFeedback state={mailState} />
          <SubmitButton
            idle={confirmationSentLabel ? 'Bestätigungsmail erneut senden' : 'Bestätigungsmail jetzt senden'}
            pending="Wird gesendet …"
            primary={!confirmationSentLabel}
          />
        </form>
      ) : null}
    </section>
  );
}

/** Alle offenen Zahlungen abgleichen und fehlende Mails nachsenden. */
export function CatchUpPaymentsButton() {
  const [state, formAction] = useActionState(catchUpPaymentsAction, INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      <FormFeedback state={state} />
      <SubmitButton idle="Jetzt nachholen" pending="Gleiche mit Stripe ab …" primary />
    </form>
  );
}
