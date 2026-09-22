'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LockKeyholeIcon, LockKeyholeOpenIcon } from 'lucide-react';
import { FormFeedback } from '@/components/admin/form-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  clearAccessCodeAction,
  updateAccessCodeAction,
  type ActionState,
} from '@/app/admin/(panel)/actions';

const INITIAL: ActionState = { status: 'idle' };

function SetButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Wird gespeichert …' : 'Code setzen'}
    </Button>
  );
}

function ClearButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      <LockKeyholeOpenIcon aria-hidden="true" />
      {pending ? 'Wird aufgehoben …' : 'Zugangsschutz aufheben'}
    </Button>
  );
}

export function AccessCodeForm({ active, hint }: { active: boolean; hint: string }) {
  const [setState, setAction] = useActionState(updateAccessCodeAction, INITIAL);
  const [clearState, clearAction] = useActionState(clearAccessCodeAction, INITIAL);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">
          Zugangscode
          {active ? (
            <Badge variant="gold">
              <LockKeyholeIcon aria-hidden="true" />
              aktiv
            </Badge>
          ) : (
            <Badge variant="outline">Shop ist öffentlich</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Ist ein Code gesetzt, kommt niemand ohne ihn in den Bestellbereich. Impressum,
          Datenschutzerklärung und die Bestellseite mit persönlichem Link bleiben auch dann
          erreichbar – Rechtstexte dürfen nicht hinter einer Hürde liegen.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <form action={setAction} className="space-y-4">
          <FormFeedback state={setState} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="accessCode" className="mb-1.5">
                Neuer Code
              </Label>
              <Input
                id="accessCode"
                name="accessCode"
                required
                minLength={4}
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Groß- und Kleinschreibung sowie Leerzeichen spielen keine Rolle.
              </p>
            </div>

            <div>
              <Label htmlFor="accessHint" className="mb-1.5">
                Hinweis auf der Zugangsseite
              </Label>
              <Input
                id="accessHint"
                name="accessHint"
                maxLength={200}
                defaultValue={hint}
                placeholder="Den Code findet ihr im Abichat."
              />
              <p className="text-muted-foreground mt-1 text-xs">Optional. Der Code selbst gehört hier nicht hinein.</p>
            </div>
          </div>

          <SetButton />

          <p className="text-muted-foreground text-xs">
            Gespeichert wird nur ein Argon2id-Hash. Der Code lässt sich danach nirgends mehr
            anzeigen – auch nicht hier. Wer ihn vergisst, setzt einfach einen neuen. Ein neuer
            Code meldet außerdem alle ab, die bisher freigeschaltet waren.
          </p>
        </form>

        {active ? (
          <form action={clearAction} className="border-border border-t pt-5">
            <FormFeedback state={clearState} />
            <ClearButton />
            <p className="text-muted-foreground mt-2 text-xs">
              Danach ist der Shop ohne Code erreichbar.
            </p>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
