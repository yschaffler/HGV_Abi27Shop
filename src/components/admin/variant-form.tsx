'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { FormFeedback } from '@/components/admin/form-feedback';
import { saveVariantAction, type ActionState } from '@/app/admin/(panel)/actions';

const INITIAL: ActionState = { status: 'idle' };

export type VariantFormValues = {
  id?: string;
  color: string;
  size: string;
  label: string;
  price: string;
  active: boolean;
  sortOrder: number;
};

const EMPTY: VariantFormValues = { color: '', size: '', label: '', price: '', active: true, sortOrder: 0 };

function SubmitButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary h-10 px-4 text-sm">
      {pending ? 'Speichert …' : isNew ? 'Variante hinzufügen' : 'Speichern'}
    </button>
  );
}

export function VariantForm({ productId, variant }: { productId: string; variant?: VariantFormValues }) {
  const [state, formAction] = useActionState(saveVariantAction, INITIAL);
  const values = variant ?? EMPTY;
  const key = values.id ?? `neu-${productId}`;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <FormFeedback state={state} />

      <div className="grid gap-3 sm:grid-cols-5">
        <div>
          <label htmlFor={`color-${key}`} className="field-label">Farbe</label>
          <input id={`color-${key}`} name="color" maxLength={40} defaultValue={values.color} className="field-input" />
        </div>
        <div>
          <label htmlFor={`size-${key}`} className="field-label">Größe</label>
          <input id={`size-${key}`} name="size" maxLength={20} defaultValue={values.size} className="field-input" />
        </div>
        <div>
          <label htmlFor={`label-${key}`} className="field-label">Bezeichnung</label>
          <input
            id={`label-${key}`}
            name="label"
            maxLength={60}
            defaultValue={values.label}
            placeholder="z. B. Standard"
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor={`price-${key}`} className="field-label">Preis (€)</label>
          <input
            id={`price-${key}`}
            name="price"
            required
            inputMode="decimal"
            defaultValue={values.price}
            placeholder="39,90"
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor={`sortOrder-${key}`} className="field-label">Reihenfolge</label>
          <input
            id={`sortOrder-${key}`}
            name="sortOrder"
            type="number"
            min={0}
            max={9999}
            defaultValue={values.sortOrder}
            className="field-input"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={values.active} className="size-4" />
          Bestellbar
        </label>
        <SubmitButton isNew={!values.id} />
      </div>
    </form>
  );
}
