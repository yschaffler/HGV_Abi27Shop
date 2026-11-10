'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { FormFeedback } from '@/components/admin/form-feedback';
import { changeOrderItemAction, type ActionState } from '@/app/admin/(panel)/actions';

const INITIAL: ActionState = { status: 'idle' };

export type VariantOption = {
  id: string;
  label: string;
  priceLabel: string;
  active: boolean;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Wird geändert …' : 'Ändern'}
    </button>
  );
}

/**
 * Andere Größe oder Farbe für eine Position. Die Prüfungen (gleicher Artikel, nicht
 * ausgegeben, Menge) macht der Server; die Auswahl hier zeigt nur, was sinnvoll ist.
 */
export function ChangeItemForm({
  itemId,
  currentVariantId,
  quantity,
  options,
  canNotify,
  alreadyOrdered,
}: {
  itemId: string;
  currentVariantId: string;
  quantity: number;
  options: VariantOption[];
  /** Nur bezahlte Bestellungen bekommen eine Mail. */
  canNotify: boolean;
  alreadyOrdered: boolean;
}) {
  const [state, formAction] = useActionState(changeOrderItemAction, INITIAL);
  const choices = options.filter((option) => option.id !== currentVariantId);

  if (choices.length === 0) {
    return <p className="text-muted-foreground text-sm">Zu diesem Artikel gibt es keine andere Variante.</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="itemId" value={itemId} />
      <FormFeedback state={state} />

      {alreadyOrdered ? (
        <p className="border-border rounded-lg border border-l-4 px-3 py-2 text-sm">
          Die Sammelbestellung ist schon beim Hersteller. Eine Änderung hier muss dort zusätzlich
          nachgemeldet werden.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor={`variant-${itemId}`} className="field-label">Neue Variante</label>
          <select id={`variant-${itemId}`} name="variantId" required defaultValue="" className="field-input">
            <option value="" disabled>
              Bitte wählen …
            </option>
            {choices.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} · {option.priceLabel}
                {option.active ? '' : ' (im Shop deaktiviert)'}
              </option>
            ))}
          </select>
        </div>

        {quantity > 1 ? (
          <div className="w-28">
            <label htmlFor={`quantity-${itemId}`} className="field-label">Wie viele?</label>
            <select id={`quantity-${itemId}`} name="quantity" defaultValue={quantity} className="field-input">
              {Array.from({ length: quantity }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value} von {quantity}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="quantity" value={1} />
        )}
      </div>

      {canNotify ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="notify" defaultChecked className="mt-0.5 size-4" />
          <span>Besteller per Mail informieren (aktualisierte Bestätigung mit den neuen Positionen)</span>
        </label>
      ) : null}

      <p className="text-muted-foreground text-xs">
        Der bezahlte Preis bleibt. Die Änderung steht danach überall – Sammelbestellung, Export,
        Statistik, Ausgabe – und im Protokoll.
      </p>

      <SubmitButton />
    </form>
  );
}
