'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { SendIcon, RotateCwIcon } from 'lucide-react';
import { FormFeedback } from '@/components/admin/form-feedback';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  retryBroadcastAction,
  sendBroadcastAction,
  type ActionState,
} from '@/app/admin/(panel)/actions';

const INITIAL: ActionState = { status: 'idle' };

const VORLAGE = `am Freitag, den 13. November, könnt ihr eure Hoodies abholen.

Wann: 12:30 bis 14:00 Uhr
Wo: Pausenhalle, beim Stand der Q-Sprecher

Bringt bitte eure Bestellnummer mit – ausgedruckt oder einfach auf dem Handy.`;

function SendButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      <SendIcon aria-hidden="true" />
      {pending ? 'Wird versendet …' : 'Rundmail versenden'}
    </Button>
  );
}

export function BroadcastForm({
  paidCount,
  openCount,
  shopName,
}: {
  paidCount: number;
  openCount: number;
  shopName: string;
}) {
  const [state, formAction] = useActionState(sendBroadcastAction, INITIAL);
  const [body, setBody] = useState(VORLAGE);
  const [subject, setSubject] = useState('Abholung eurer Abi-Hoodies');

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>Neue Rundmail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormFeedback state={state} />

            <div>
              <Label htmlFor="audience" className="mb-1.5">
                Empfänger
              </Label>
              <NativeSelect id="audience" name="audience" defaultValue="PAID_NOT_DISTRIBUTED">
                <option value="PAID_NOT_DISTRIBUTED">
                  Bezahlt, noch nicht abgeholt ({openCount})
                </option>
                <option value="PAID">Alle bezahlten Bestellungen ({paidCount})</option>
              </NativeSelect>
              <p className="text-muted-foreground mt-1 text-xs">
                Unbezahlte Bestellungen bekommen nie eine Abholmail – da gibt es nichts abzuholen.
              </p>
            </div>

            <div>
              <Label htmlFor="subject" className="mb-1.5">
                Betreff
              </Label>
              <Input
                id="subject"
                name="subject"
                required
                maxLength={150}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="body" className="mb-1.5">
                Nachricht
              </Label>
              <Textarea
                id="body"
                name="body"
                required
                rows={10}
                maxLength={5000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Freitext. Anrede, Bestellnummer und der persönliche Link werden automatisch
                ergänzt. HTML wird nicht ausgewertet.
              </p>
            </div>

            <Separator />

            <div>
              <Label htmlFor="confirm" className="mb-1.5">
                Zum Absenden SENDEN eintippen
              </Label>
              <Input
                id="confirm"
                name="confirm"
                required
                autoComplete="off"
                placeholder="SENDEN"
                className="sm:max-w-40"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Eine Rundmail lässt sich nicht zurückholen. Deshalb der zweite Handgriff.
              </p>
            </div>

            <SendButton />
          </CardContent>
        </Card>
      </form>

      <aside className="h-fit lg:sticky lg:top-6">
        <Card>
          <CardHeader>
            <CardTitle>Vorschau</CardTitle>
          </CardHeader>
          <CardContent>
            {/*
              Die Vorschau wird im Browser aus denselben Bausteinen zusammengesetzt wie die
              echte Mail auf dem Server. Sie zeigt, was ankommt – ohne dafuer eine Testmail
              an irgendjemanden zu schicken.
            */}
            <p className="text-muted-foreground text-xs">Betreff</p>
            <p className="text-foreground text-sm font-medium break-words">{subject || '—'}</p>

            <Separator className="my-3" />

            <pre className="text-muted-foreground font-sans text-sm whitespace-pre-wrap">
{`Hallo Max,

${body.trim()}

Deine Bestellnummer: ABI-BEISPIEL
Deine Bestellung: https://…/bestellung/…

${shopName}`}
            </pre>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function RetryButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      <RotateCwIcon aria-hidden="true" />
      {pending ? 'Läuft …' : 'Fehlende erneut anschreiben'}
    </Button>
  );
}

export function RetryBroadcastButton({ broadcastId }: { broadcastId: string }) {
  const [state, formAction] = useActionState(retryBroadcastAction, INITIAL);

  return (
    <div className="text-right">
      <form action={formAction}>
        <input type="hidden" name="broadcastId" value={broadcastId} />
        <RetryButton />
      </form>
      {state.status !== 'idle' ? (
        <div className="mt-2">
          <FormFeedback state={state} />
        </div>
      ) : null}
    </div>
  );
}
