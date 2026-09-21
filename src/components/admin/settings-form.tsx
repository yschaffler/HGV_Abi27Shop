'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { FormFeedback } from '@/components/admin/form-feedback';
import { updateSettingsAction, type ActionState } from '@/app/admin/(panel)/actions';

const INITIAL: ActionState = { status: 'idle' };

export type SettingsFormValues = {
  shopName: string;
  contactEmail: string;
  orderStartAt: string;
  orderEndAt: string;
  closedNotice: string;
  pickupInfo: string;
  imprintText: string;
  privacyText: string;
  withdrawalText: string;
  termsText: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Wird gespeichert …' : 'Einstellungen speichern'}
    </button>
  );
}

function LegalField({
  id,
  label,
  hint,
  defaultValue,
}: {
  id: keyof SettingsFormValues;
  label: string;
  hint: string;
  defaultValue: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <textarea id={id} name={id} rows={8} maxLength={20000} defaultValue={defaultValue} className="field-input font-mono text-sm" />
      <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
    </div>
  );
}

export function SettingsForm({ values }: { values: SettingsFormValues }) {
  const [state, formAction] = useActionState(updateSettingsAction, INITIAL);

  return (
    <form action={formAction} className="space-y-8">
      <FormFeedback state={state} />

      <section className="surface-card space-y-4 rounded-xl p-5">
        <h2 className="text-lg">Allgemein</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="shopName" className="field-label">Name des Shops</label>
            <input id="shopName" name="shopName" required maxLength={80} defaultValue={values.shopName} className="field-input" />
          </div>

          <div>
            <label htmlFor="contactEmail" className="field-label">Kontakt-E-Mail</label>
            <input id="contactEmail" name="contactEmail" type="email" maxLength={180} defaultValue={values.contactEmail} className="field-input" />
          </div>
        </div>
      </section>

      <section className="surface-card space-y-4 rounded-xl p-5">
        <h2 className="text-lg">Bestellzeitraum</h2>
        <p className="text-muted-foreground text-sm">
          Zeiten in deutscher Ortszeit (Europe/Berlin). Außerhalb dieses Zeitraums lehnt der
          Server neue Bestellungen ab – unabhängig davon, was im Browser noch offen ist.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="orderStartAt" className="field-label">Start</label>
            <input id="orderStartAt" name="orderStartAt" type="datetime-local" defaultValue={values.orderStartAt} className="field-input" />
          </div>

          <div>
            <label htmlFor="orderEndAt" className="field-label">Bestellschluss</label>
            <input id="orderEndAt" name="orderEndAt" type="datetime-local" defaultValue={values.orderEndAt} className="field-input" />
          </div>
        </div>

        <div>
          <label htmlFor="closedNotice" className="field-label">Hinweis außerhalb des Zeitraums</label>
          <textarea id="closedNotice" name="closedNotice" rows={2} maxLength={1000} defaultValue={values.closedNotice} className="field-input" />
        </div>
      </section>

      <section className="surface-card space-y-4 rounded-xl p-5">
        <h2 className="text-lg">Abholung</h2>
        <div>
          <label htmlFor="pickupInfo" className="field-label">Hinweis zur Ausgabe</label>
          <textarea id="pickupInfo" name="pickupInfo" rows={4} maxLength={2000} defaultValue={values.pickupInfo} className="field-input" />
          <p className="text-muted-foreground mt-1 text-xs">
            Erscheint im Shop, auf der Bestellseite und in der Bestätigungsmail.
          </p>
        </div>
      </section>

      <section className="surface-card space-y-5 rounded-xl p-5">
        <div>
          <h2 className="text-lg">Rechtstexte</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Markdown ist erlaubt: <code className="bg-muted rounded px-1">#</code> und{' '}
            <code className="bg-muted rounded px-1">##</code> für Überschriften,{' '}
            <code className="bg-muted rounded px-1">**fett**</code>,{' '}
            <code className="bg-muted rounded px-1">-</code> für Aufzählungen und{' '}
            <code className="bg-muted rounded px-1">[Text](https://…)</code> für Links.
            HTML wird bewusst nicht ausgewertet und erscheint als Text.
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            Vor dem Livegang ausfüllen und rechtlich prüfen lassen – die offenen Punkte stehen in
            LEGAL_CHECKLIST.md.
          </p>
        </div>

        <LegalField
          id="imprintText"
          label="Impressum"
          hint="Wer betreibt den Shop? Vollständige Angaben nach § 5 DDG bzw. den heute geltenden Vorschriften."
          defaultValue={values.imprintText}
        />
        <LegalField
          id="privacyText"
          label="Datenschutzerklärung"
          hint="Erhoben werden Vorname, Nachname, E-Mail und Klasse. Weitergabe an Stripe (Zahlung) und den Mailversender."
          defaultValue={values.privacyText}
        />
        <LegalField
          id="withdrawalText"
          label="Widerrufsbelehrung"
          hint="Nicht pauschal annehmen, dass personalisierte Abi-Artikel vom Widerruf ausgenommen sind. Prüfen lassen."
          defaultValue={values.withdrawalText}
        />
        <LegalField
          id="termsText"
          label="AGB / Bedingungen"
          hint="Ablauf, Sammelbestellung, Ausgabe in der Schule, kein Versand, Zahlungsarten."
          defaultValue={values.termsText}
        />
      </section>

      <SubmitButton />
    </form>
  );
}
