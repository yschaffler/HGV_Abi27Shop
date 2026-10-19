'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Trash2Icon } from 'lucide-react';
import { FormFeedback } from '@/components/admin/form-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  clearHeroImageAction,
  updateHeroImageAction,
  type ActionState,
} from '@/app/admin/(panel)/actions';

const INITIAL: ActionState = { status: 'idle' };

function UploadButton({ replacing }: { replacing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Wird hochgeladen …' : replacing ? 'Cover ersetzen' : 'Cover hochladen'}
    </Button>
  );
}

function ClearButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      <Trash2Icon aria-hidden="true" />
      {pending ? 'Wird entfernt …' : 'Cover entfernen'}
    </Button>
  );
}

export function HeroImageForm({ mediaId }: { mediaId: string | null }) {
  const [uploadState, uploadAction] = useActionState(updateHeroImageAction, INITIAL);
  const [clearState, clearAction] = useActionState(clearHeroImageAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  // Nach erfolgreichem Upload die Dateiauswahl leeren.
  useEffect(() => {
    if (uploadState.status === 'ok') formRef.current?.reset();
  }, [uploadState]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">
          Cover der Startseite
          {mediaId ? <Badge variant="ink">eigenes Cover</Badge> : <Badge variant="outline">Titelbilder der Produkte</Badge>}
        </CardTitle>
        <CardDescription>
          Das Bild rechts oben im Hero der Startseite. Ohne eigenes Cover stehen dort die
          Titelbilder der Produkte.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {mediaId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/media/${mediaId}`}
            alt="Aktuelles Cover"
            className="bg-night max-h-64 w-auto rounded-lg object-contain p-3"
          />
        ) : null}

        <form ref={formRef} action={uploadAction} className="space-y-4">
          <FormFeedback state={uploadState} successMessage="Cover gespeichert." />

          <div>
            <Label htmlFor="heroImage" className="mb-1.5">
              Bild (PNG, JPEG oder WebP, max. 2 MB)
            </Label>
            <input
              id="heroImage"
              name="image"
              type="file"
              required
              accept="image/png,image/jpeg,image/webp"
              className="field-input py-2"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Der Hero ist dunkelblau. Am besten wirkt ein freigestelltes Bild (PNG oder WebP mit
              transparentem Hintergrund) im Hochformat.
            </p>
          </div>

          <UploadButton replacing={mediaId !== null} />
        </form>

        {mediaId ? (
          <form action={clearAction} className="border-border border-t pt-5">
            <FormFeedback state={clearState} successMessage="Cover entfernt." />
            <ClearButton />
            <p className="text-muted-foreground mt-2 text-xs">
              Danach zeigt die Startseite wieder die Titelbilder der Produkte.
            </p>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
