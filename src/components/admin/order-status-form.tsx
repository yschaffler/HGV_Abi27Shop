'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { FormFeedback } from '@/components/admin/form-feedback';
import { updateOrderStatusAction, type ActionState } from '@/app/admin/(panel)/actions';
import { FULFILLMENT_STATUSES, PAYMENT_STATUSES } from '@/lib/validation/admin';

const INITIAL: ActionState = { status: 'idle' };

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: 'Zahlung ausstehend',
  PAID: 'Bezahlt',
  FAILED: 'Fehlgeschlagen',
  REFUNDED: 'Erstattet',
  CANCELLED: 'Storniert',
};

const FULFILLMENT_LABEL: Record<string, string> = {
  NEW: 'Neu',
  ORDERED: 'Beim Hersteller bestellt',
  ARRIVED: 'Ware eingetroffen',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Wird gespeichert …' : 'Status speichern'}
    </button>
  );
}

export function OrderStatusForm({
  orderId,
  paymentStatus,
  fulfillmentStatus,
}: {
  orderId: string;
  paymentStatus: string;
  fulfillmentStatus: string;
}) {
  const [state, formAction] = useActionState(updateOrderStatusAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />

      <FormFeedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="paymentStatus" className="field-label">Zahlungsstatus</label>
          <select id="paymentStatus" name="paymentStatus" defaultValue={paymentStatus} className="field-input">
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>{PAYMENT_LABEL[status]}</option>
            ))}
          </select>
          <p className="text-muted-foreground mt-1 text-xs">
            Im Normalfall setzt das der Stripe-Webhook. Manuelle Änderungen landen im Protokoll.
          </p>
        </div>

        <div>
          <label htmlFor="fulfillmentStatus" className="field-label">Sammelbestellung</label>
          <select id="fulfillmentStatus" name="fulfillmentStatus" defaultValue={fulfillmentStatus} className="field-input">
            {FULFILLMENT_STATUSES.map((status) => (
              <option key={status} value={status}>{FULFILLMENT_LABEL[status]}</option>
            ))}
          </select>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
