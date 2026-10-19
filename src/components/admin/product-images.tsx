'use client';

import { useActionState, useRef, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from 'lucide-react';
import { FormFeedback } from '@/components/admin/form-feedback';
import {
  addProductImageAction,
  updateProductImageAction,
  type ActionState,
} from '@/app/admin/(panel)/actions';

const INITIAL: ActionState = { status: 'idle' };

export type AdminProductImage = {
  id: string;
  mediaId: string;
  caption: string;
};

function IconSubmit({
  intent,
  label,
  disabled,
  children,
}: {
  intent: string;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      aria-label={label}
      title={label}
      disabled={disabled || pending}
      className="border-border hover:bg-muted grid size-9 place-items-center rounded-md border disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ImageRow({
  image,
  productName,
  isFirst,
  isLast,
}: {
  image: AdminProductImage;
  productName: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, formAction] = useActionState(updateProductImageAction, INITIAL);

  return (
    <li className="border-border rounded-lg border p-3">
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="imageId" value={image.id} />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/media/${image.mediaId}`}
          alt={image.caption || productName}
          className="bg-muted size-16 shrink-0 rounded-md object-cover"
        />

        <div className="min-w-40 flex-1">
          <label htmlFor={`caption-${image.id}`} className="sr-only">Beschriftung</label>
          <input
            id={`caption-${image.id}`}
            name="caption"
            maxLength={60}
            defaultValue={image.caption}
            placeholder="z. B. Vorne, Hinten, Detail"
            className="field-input"
          />
          {isFirst ? <p className="text-muted-foreground mt-1 text-xs">Titelbild</p> : null}
        </div>

        <div className="flex gap-1.5">
          <IconSubmit intent="caption" label="Beschriftung speichern">
            <span className="text-xs font-semibold">OK</span>
          </IconSubmit>
          <IconSubmit intent="up" label="Nach vorne" disabled={isFirst}>
            <ArrowUpIcon className="size-4" aria-hidden="true" />
          </IconSubmit>
          <IconSubmit intent="down" label="Nach hinten" disabled={isLast}>
            <ArrowDownIcon className="size-4" aria-hidden="true" />
          </IconSubmit>
          <IconSubmit intent="remove" label="Bild entfernen">
            <Trash2Icon className="text-destructive size-4" aria-hidden="true" />
          </IconSubmit>
        </div>
      </form>
      {state.status === 'error' ? (
        <div className="mt-2">
          <FormFeedback state={state} />
        </div>
      ) : null}
    </li>
  );
}

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-secondary">
      {pending ? 'Wird hochgeladen …' : 'Bild hinzufügen'}
    </button>
  );
}

export function ProductImages({
  productId,
  productName,
  images,
  maxImages,
}: {
  productId: string;
  productName: string;
  images: AdminProductImage[];
  maxImages: number;
}) {
  const [state, formAction] = useActionState(addProductImageAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  // Nach erfolgreichem Upload das Formular leeren, damit nicht dasselbe Bild doppelt landet.
  useEffect(() => {
    if (state.status === 'ok') formRef.current?.reset();
  }, [state]);

  const full = images.length >= maxImages;

  return (
    <div className="space-y-3">
      {images.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Noch keine Bilder. Im Shop erscheint ein Platzhalter, bis hier eines hochgeladen ist.
        </p>
      ) : (
        <ul className="space-y-2">
          {images.map((image, index) => (
            <ImageRow
              key={image.id}
              image={image}
              productName={productName}
              isFirst={index === 0}
              isLast={index === images.length - 1}
            />
          ))}
        </ul>
      )}

      {full ? (
        <p className="text-muted-foreground text-sm">
          Maximal {maxImages} Bilder. Entferne eines, um ein neues hinzuzufügen.
        </p>
      ) : (
        <form ref={formRef} action={formAction} className="border-border space-y-3 rounded-lg border border-dashed p-3">
          <input type="hidden" name="productId" value={productId} />
          <FormFeedback state={state} successMessage="Bild hinzugefügt." />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`new-image-${productId}`} className="field-label">
                Bild (PNG, JPEG oder WebP, max. 2 MB)
              </label>
              <input
                id={`new-image-${productId}`}
                name="image"
                type="file"
                required
                accept="image/png,image/jpeg,image/webp"
                className="field-input py-2"
              />
            </div>
            <div>
              <label htmlFor={`new-caption-${productId}`} className="field-label">Beschriftung</label>
              <input
                id={`new-caption-${productId}`}
                name="caption"
                maxLength={60}
                placeholder="z. B. Vorne"
                className="field-input"
              />
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            Am besten Hochformat (4:5) auf ruhigem Hintergrund. Das erste Bild ist das Titelbild;
            die Reihenfolge lässt sich mit den Pfeilen ändern.
          </p>

          <UploadButton />
        </form>
      )}
    </div>
  );
}
