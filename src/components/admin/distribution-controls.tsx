'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckIcon, UndoIcon } from 'lucide-react';
import { FormFeedback } from '@/components/admin/form-feedback';
import { Button } from '@/components/ui/button';
import {
  setItemDistributionAction,
  setOrderDistributionAction,
  type ActionState,
} from '@/app/admin/(panel)/actions';

const INITIAL: ActionState = { status: 'idle' };

/**
 * Korrektur des Ausgabestatus.
 *
 * Jede Schaltflaeche ist ein eigenes Formular mit einem versteckten Feld. Das sieht
 * umstaendlicher aus als ein onClick-Handler, hat aber zwei Vorteile: Es funktioniert ohne
 * JavaScript, und der gewuenschte Zielzustand steht im Formular statt im Zustand der
 * Komponente – zwei Klicks hintereinander koennen also nichts durcheinanderbringen.
 */

function ActionButton({
  label,
  pendingLabel,
  variant,
  icon,
}: {
  label: string;
  pendingLabel: string;
  variant: 'outline' | 'destructive' | 'default';
  icon: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {icon}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ItemDistributionToggle({
  itemId,
  distributed,
}: {
  itemId: string;
  distributed: boolean;
}) {
  const [state, formAction] = useActionState(setItemDistributionAction, INITIAL);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="distributed" value={distributed ? 'false' : 'true'} />
        {distributed ? (
          <ActionButton
            label="Ausgabe zurücknehmen"
            pendingLabel="Wird zurückgenommen …"
            variant="outline"
            icon={<UndoIcon aria-hidden="true" />}
          />
        ) : (
          <ActionButton
            label="Als ausgegeben markieren"
            pendingLabel="Wird gespeichert …"
            variant="outline"
            icon={<CheckIcon aria-hidden="true" />}
          />
        )}
      </form>

      {state.status !== 'idle' ? (
        <div className="mt-2">
          <FormFeedback state={state} />
        </div>
      ) : null}
    </div>
  );
}

export function OrderDistributionControls({
  orderId,
  hasDistributed,
  hasOpen,
}: {
  orderId: string;
  hasDistributed: boolean;
  hasOpen: boolean;
}) {
  const [state, formAction] = useActionState(setOrderDistributionAction, INITIAL);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {hasOpen ? (
          <form action={formAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="distributed" value="true" />
            <ActionButton
              label="Alles als ausgegeben markieren"
              pendingLabel="Wird gespeichert …"
              variant="default"
              icon={<CheckIcon aria-hidden="true" />}
            />
          </form>
        ) : null}

        {hasDistributed ? (
          <form action={formAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="distributed" value="false" />
            <ActionButton
              label="Gesamte Ausgabe zurücknehmen"
              pendingLabel="Wird zurückgenommen …"
              variant="outline"
              icon={<UndoIcon aria-hidden="true" />}
            />
          </form>
        ) : null}
      </div>

      <FormFeedback state={state} />

      <p className="text-muted-foreground text-xs">
        Jede Änderung steht mit Zeitpunkt und Konto im Protokoll. An der Ausgabe selbst lässt
        sich nichts zurücknehmen – das geht bewusst nur hier.
      </p>
    </div>
  );
}
