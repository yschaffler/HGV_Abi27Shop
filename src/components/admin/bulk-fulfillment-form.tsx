'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { FormFeedback } from '@/components/admin/form-feedback';
import { bulkFulfillmentAction, type ActionState } from '@/app/admin/(panel)/actions';

const INITIAL: ActionState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-secondary">
      {pending ? 'Wird gesetzt …' : 'Status setzen'}
    </button>
  );
}

/**
 * Setzt den Sammelbestellungsstatus für alle bezahlten Bestellungen auf einmal –
 * der übliche Ablauf, wenn die Bestellung beim Hersteller rausgegangen oder die Ware
 * angekommen ist.
 */
export function BulkFulfillmentForm() {
  const [state, formAction] = useActionState(bulkFulfillmentAction, INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      <FormFeedback state={state} successMessage="Status für alle bezahlten Bestellungen gesetzt." />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="fulfillmentStatus" className="field-label">Neuer Status</label>
          <select id="fulfillmentStatus" name="fulfillmentStatus" className="field-input sm:w-64">
            <option value="ORDERED">Beim Hersteller bestellt</option>
            <option value="ARRIVED">Ware eingetroffen</option>
            <option value="NEW">Zurück auf Neu</option>
          </select>
        </div>
        <SubmitButton />
      </div>
    </form>
  );
}
