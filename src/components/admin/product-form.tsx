'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { FormFeedback } from '@/components/admin/form-feedback';
import { saveProductAction, type ActionState } from '@/app/admin/(panel)/actions';

const INITIAL: ActionState = { status: 'idle' };

export type ProductFormValues = {
  id?: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  imageId: string | null;
  active: boolean;
  sortOrder: number;
};

const EMPTY: ProductFormValues = {
  slug: '',
  name: '',
  summary: '',
  description: '',
  imageId: null,
  active: true,
  sortOrder: 0,
};

function SubmitButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Wird gespeichert …' : isNew ? 'Produkt anlegen' : 'Änderungen speichern'}
    </button>
  );
}

export function ProductForm({ product }: { product?: ProductFormValues }) {
  const [state, formAction] = useActionState(saveProductAction, INITIAL);
  const values = product ?? EMPTY;
  const isNew = !values.id;

  return (
    <form action={formAction} className="space-y-4">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {values.imageId ? <input type="hidden" name="imageId" value={values.imageId} /> : null}

      <FormFeedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`name-${values.id ?? 'neu'}`} className="field-label">Name</label>
          <input
            id={`name-${values.id ?? 'neu'}`}
            name="name"
            required
            maxLength={120}
            defaultValue={values.name}
            className="field-input"
          />
        </div>

        <div>
          <label htmlFor={`slug-${values.id ?? 'neu'}`} className="field-label">Kurz-URL</label>
          <input
            id={`slug-${values.id ?? 'neu'}`}
            name="slug"
            required
            maxLength={60}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            defaultValue={values.slug}
            placeholder="abipulli"
            className="field-input"
          />
          <p className="text-muted mt-1 text-xs">Erscheint in der Adresse: /produkte/abipulli</p>
        </div>
      </div>

      <div>
        <label htmlFor={`summary-${values.id ?? 'neu'}`} className="field-label">Kurztext</label>
        <input
          id={`summary-${values.id ?? 'neu'}`}
          name="summary"
          maxLength={200}
          defaultValue={values.summary}
          className="field-input"
        />
      </div>

      <div>
        <label htmlFor={`description-${values.id ?? 'neu'}`} className="field-label">Beschreibung</label>
        <textarea
          id={`description-${values.id ?? 'neu'}`}
          name="description"
          rows={4}
          maxLength={4000}
          defaultValue={values.description}
          className="field-input"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`image-${values.id ?? 'neu'}`} className="field-label">Bild (PNG, JPEG oder WebP, max. 2 MB)</label>
          <input
            id={`image-${values.id ?? 'neu'}`}
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="field-input py-2"
          />
          <p className="text-muted mt-1 text-xs">
            Leer lassen, um das vorhandene Bild zu behalten. Der Dateityp wird serverseitig am Inhalt geprüft.
          </p>
        </div>

        <div>
          <label htmlFor={`sortOrder-${values.id ?? 'neu'}`} className="field-label">Reihenfolge</label>
          <input
            id={`sortOrder-${values.id ?? 'neu'}`}
            name="sortOrder"
            type="number"
            min={0}
            max={9999}
            defaultValue={values.sortOrder}
            className="field-input sm:max-w-32"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={values.active} className="size-4" />
        Im Shop sichtbar
      </label>

      <SubmitButton isNew={isNew} />
    </form>
  );
}
