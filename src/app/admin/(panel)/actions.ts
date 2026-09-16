'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { parseEuroInput } from '@/lib/money';
import {
  FULFILLMENT_STATUSES,
  PAYMENT_STATUSES,
  idSchema,
  productSchema,
  settingsSchema,
  userSchema,
  variantSchema,
} from '@/lib/validation/admin';
import { recordAudit } from '@/server/audit';
import { authorize } from '@/server/auth/rbac';
import { destroyAllSessionsForUser } from '@/server/auth/session';
import { hashPassword, passwordSchema } from '@/server/auth/password';
import { prisma } from '@/server/db';
import { logUnexpected } from '@/server/logger';
import { storeProductImage } from '@/server/media';
import { assertSameOrigin } from '@/server/request-context';
import { SETTINGS_ID } from '@/server/settings';

/**
 * Schreibende Aktionen des Adminbereichs.
 *
 * Jede einzelne Action beginnt mit `authorize(['ADMIN'])`. Dass die Navigation für
 * Nicht-Admins gar nicht erst angezeigt wird, zählt ausdrücklich nicht als Schutz –
 * Server Actions sind aufrufbare Endpunkte.
 *
 * Alles, was Geld, Berechtigungen oder Warenausgabe betrifft, landet im Audit-Log.
 */

export type ActionState = { status: 'idle' | 'ok' | 'error'; message?: string };

const OK: ActionState = { status: 'ok' };

function fail(message: string): ActionState {
  return { status: 'error', message };
}

function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Eingabe ungültig.';
}

/** Ein Wert, den ein Checkbox-Formularfeld liefert (vorhanden = an). */
function checkbox(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === 'on' || value === 'true';
}

/** "2026-09-20T12:00" im Browser ist lokale Zeit; ohne Zeitzone wäre die Auslegung Zufall. */
function parseBerlinDateTime(value: string | undefined): Date | null {
  if (!value) return null;

  // Europe/Berlin ist je nach Datum UTC+1 oder UTC+2. Der Versatz wird für genau diesen
  // Zeitpunkt bestimmt, statt eine feste Stunde anzunehmen.
  const naive = new Date(`${value}:00Z`);
  if (Number.isNaN(naive.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(naive).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  const asBerlin = Date.UTC(
    Number(parts['year']),
    Number(parts['month']) - 1,
    Number(parts['day']),
    Number(parts['hour'] === '24' ? '0' : parts['hour']),
    Number(parts['minute']),
    Number(parts['second']),
  );

  const offsetMs = asBerlin - naive.getTime();
  return new Date(naive.getTime() - offsetMs);
}

// ---------------------------------------------------------------------------
// Produkte und Varianten
// ---------------------------------------------------------------------------

export async function saveProductAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const origin = await assertSameOrigin();
  if (!origin.ok) return fail(origin.message);

  const auth = await authorize(['ADMIN']);
  if (!auth.ok) return fail(auth.error);

  const parsed = productSchema.safeParse({
    id: formData.get('id') || undefined,
    slug: formData.get('slug'),
    name: formData.get('name'),
    summary: formData.get('summary') || undefined,
    description: formData.get('description') || undefined,
    imageId: formData.get('imageId') || undefined,
    active: checkbox(formData, 'active'),
    sortOrder: formData.get('sortOrder') ?? 0,
  });

  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    const imageFile = formData.get('image');
    let imageId = parsed.data.imageId ?? null;

    if (imageFile instanceof File && imageFile.size > 0) {
      const upload = await storeProductImage({ file: imageFile, userId: auth.user.id });
      if (!upload.ok) return fail(upload.message);
      imageId = upload.mediaId;
    }

    const data = {
      slug: parsed.data.slug,
      name: parsed.data.name,
      summary: parsed.data.summary ?? null,
      description: parsed.data.description ?? null,
      imageId,
      active: parsed.data.active,
      sortOrder: parsed.data.sortOrder,
    };

    if (parsed.data.id) {
      await prisma.product.update({ where: { id: parsed.data.id }, data });
      await recordAudit({
        actor: auth.user,
        action: 'PRODUCT_UPDATED',
        entityType: 'Product',
        entityId: parsed.data.id,
        summary: `Produkt "${data.name}" geändert (aktiv: ${data.active ? 'ja' : 'nein'})`,
      });
    } else {
      const created = await prisma.product.create({ data, select: { id: true } });
      await recordAudit({
        actor: auth.user,
        action: 'PRODUCT_CREATED',
        entityType: 'Product',
        entityId: created.id,
        summary: `Produkt "${data.name}" angelegt`,
      });
    }
  } catch (error) {
    if (isUniqueError(error)) return fail('Diese Kurz-URL ist bereits vergeben.');
    const errorId = logUnexpected('saveProductAction', error);
    return fail(`Speichern fehlgeschlagen. (Kennung ${errorId})`);
  }

  revalidatePath('/admin/products');
  revalidatePath('/');
  return OK;
}

export async function saveVariantAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const origin = await assertSameOrigin();
  if (!origin.ok) return fail(origin.message);

  const auth = await authorize(['ADMIN']);
  if (!auth.ok) return fail(auth.error);

  const parsed = variantSchema.safeParse({
    id: formData.get('id') || undefined,
    productId: formData.get('productId'),
    color: formData.get('color') ?? '',
    size: formData.get('size') ?? '',
    label: formData.get('label') ?? '',
    price: formData.get('price'),
    active: checkbox(formData, 'active'),
    sortOrder: formData.get('sortOrder') ?? 0,
  });

  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  let priceCents: number;
  try {
    priceCents = parseEuroInput(parsed.data.price);
  } catch {
    return fail('Ungültiger Preis. Beispiel: 39,90');
  }

  if (priceCents < 50) return fail('Der Preis muss mindestens 0,50 € betragen.');

  // Eine Variante ohne jedes Merkmal wäre in Listen nicht unterscheidbar.
  if (!parsed.data.color && !parsed.data.size && !parsed.data.label) {
    return fail('Bitte mindestens Farbe, Größe oder eine Bezeichnung angeben.');
  }

  try {
    const data = {
      productId: parsed.data.productId,
      color: parsed.data.color,
      size: parsed.data.size,
      label: parsed.data.label,
      priceCents,
      active: parsed.data.active,
      sortOrder: parsed.data.sortOrder,
    };

    if (parsed.data.id) {
      const before = await prisma.productVariant.findUnique({
        where: { id: parsed.data.id },
        select: { priceCents: true },
      });

      await prisma.productVariant.update({ where: { id: parsed.data.id }, data });

      await recordAudit({
        actor: auth.user,
        action: 'VARIANT_UPDATED',
        entityType: 'ProductVariant',
        entityId: parsed.data.id,
        summary:
          before && before.priceCents !== priceCents
            ? `Preis geändert: ${before.priceCents} → ${priceCents} Cent`
            : `Variante geändert (aktiv: ${data.active ? 'ja' : 'nein'})`,
      });
    } else {
      const created = await prisma.productVariant.create({ data, select: { id: true } });
      await recordAudit({
        actor: auth.user,
        action: 'VARIANT_CREATED',
        entityType: 'ProductVariant',
        entityId: created.id,
        summary: `Variante angelegt: ${[data.color, data.size, data.label].filter(Boolean).join(' · ')} zu ${priceCents} Cent`,
      });
    }
  } catch (error) {
    if (isUniqueError(error)) return fail('Diese Kombination aus Farbe, Größe und Bezeichnung gibt es bereits.');
    const errorId = logUnexpected('saveVariantAction', error);
    return fail(`Speichern fehlgeschlagen. (Kennung ${errorId})`);
  }

  revalidatePath('/admin/products');
  revalidatePath('/');
  return OK;
}

// ---------------------------------------------------------------------------
// Bestellstatus
// ---------------------------------------------------------------------------

const statusUpdateSchema = z.object({
  orderId: idSchema,
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  fulfillmentStatus: z.enum(FULFILLMENT_STATUSES).optional(),
});

/**
 * Manuelle Statuskorrektur.
 *
 * Der Normalfall ist, dass der Zahlungsstatus ausschließlich vom Stripe-Webhook gesetzt wird.
 * Diese Aktion ist für Sonderfälle (Barzahlung, Storno nach Absprache, Korrektur nach einer
 * Rückerstattung) gedacht und deshalb immer im Audit-Log nachvollziehbar.
 */
export async function updateOrderStatusAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const origin = await assertSameOrigin();
  if (!origin.ok) return fail(origin.message);

  const auth = await authorize(['ADMIN']);
  if (!auth.ok) return fail(auth.error);

  const parsed = statusUpdateSchema.safeParse({
    orderId: formData.get('orderId'),
    paymentStatus: formData.get('paymentStatus') || undefined,
    fulfillmentStatus: formData.get('fulfillmentStatus') || undefined,
  });

  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  try {
    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      select: { orderNumber: true, paymentStatus: true, fulfillmentStatus: true },
    });

    if (!order) return fail('Bestellung nicht gefunden.');

    if (parsed.data.paymentStatus && parsed.data.paymentStatus !== order.paymentStatus) {
      await prisma.order.update({
        where: { id: parsed.data.orderId },
        data: {
          paymentStatus: parsed.data.paymentStatus,
          paidAt: parsed.data.paymentStatus === 'PAID' ? new Date() : null,
        },
      });

      await recordAudit({
        actor: auth.user,
        action: 'ORDER_PAYMENT_STATUS_CHANGED',
        entityType: 'Order',
        entityId: parsed.data.orderId,
        summary: `${order.orderNumber}: ${order.paymentStatus} → ${parsed.data.paymentStatus} (manuell)`,
      });
    }

    if (parsed.data.fulfillmentStatus && parsed.data.fulfillmentStatus !== order.fulfillmentStatus) {
      await prisma.order.update({
        where: { id: parsed.data.orderId },
        data: { fulfillmentStatus: parsed.data.fulfillmentStatus },
      });

      await recordAudit({
        actor: auth.user,
        action: 'ORDER_FULFILLMENT_STATUS_CHANGED',
        entityType: 'Order',
        entityId: parsed.data.orderId,
        summary: `${order.orderNumber}: ${order.fulfillmentStatus} → ${parsed.data.fulfillmentStatus}`,
      });
    }
  } catch (error) {
    const errorId = logUnexpected('updateOrderStatusAction', error);
    return fail(`Speichern fehlgeschlagen. (Kennung ${errorId})`);
  }

  revalidatePath('/admin/orders');
  return OK;
}

/** Setzt den Sammelbestellungsstatus für alle bezahlten Bestellungen auf einmal. */
export async function bulkFulfillmentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const origin = await assertSameOrigin();
  if (!origin.ok) return fail(origin.message);

  const auth = await authorize(['ADMIN']);
  if (!auth.ok) return fail(auth.error);

  const parsed = z.enum(FULFILLMENT_STATUSES).safeParse(formData.get('fulfillmentStatus'));
  if (!parsed.success) return fail('Ungültiger Status.');

  try {
    const result = await prisma.order.updateMany({
      where: { paymentStatus: 'PAID', fulfillmentStatus: { not: parsed.data } },
      data: { fulfillmentStatus: parsed.data },
    });

    await recordAudit({
      actor: auth.user,
      action: 'ORDER_FULFILLMENT_STATUS_CHANGED',
      entityType: 'Order',
      entityId: null,
      summary: `Sammelaktion: ${result.count} bezahlte Bestellungen auf ${parsed.data} gesetzt`,
    });
  } catch (error) {
    const errorId = logUnexpected('bulkFulfillmentAction', error);
    return fail(`Speichern fehlgeschlagen. (Kennung ${errorId})`);
  }

  revalidatePath('/admin/orders');
  return OK;
}

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

export async function updateSettingsAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const origin = await assertSameOrigin();
  if (!origin.ok) return fail(origin.message);

  const auth = await authorize(['ADMIN']);
  if (!auth.ok) return fail(auth.error);

  const parsed = settingsSchema.safeParse({
    shopName: formData.get('shopName'),
    contactEmail: formData.get('contactEmail') ?? '',
    orderStartAt: formData.get('orderStartAt') ?? '',
    orderEndAt: formData.get('orderEndAt') ?? '',
    closedNotice: formData.get('closedNotice') ?? '',
    pickupInfo: formData.get('pickupInfo') ?? '',
    imprintText: formData.get('imprintText') ?? '',
    privacyText: formData.get('privacyText') ?? '',
    withdrawalText: formData.get('withdrawalText') ?? '',
    termsText: formData.get('termsText') ?? '',
  });

  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  const startAt = parseBerlinDateTime(parsed.data.orderStartAt || undefined);
  const endAt = parseBerlinDateTime(parsed.data.orderEndAt || undefined);

  if (startAt && endAt && endAt.getTime() <= startAt.getTime()) {
    return fail('Der Bestellschluss muss nach dem Start liegen.');
  }

  try {
    await prisma.settings.update({
      where: { id: SETTINGS_ID },
      data: {
        shopName: parsed.data.shopName,
        contactEmail: parsed.data.contactEmail,
        orderStartAt: startAt,
        orderEndAt: endAt,
        closedNotice: parsed.data.closedNotice || null,
        pickupInfo: parsed.data.pickupInfo,
        imprintText: parsed.data.imprintText,
        privacyText: parsed.data.privacyText,
        withdrawalText: parsed.data.withdrawalText,
        termsText: parsed.data.termsText,
      },
    });

    await recordAudit({
      actor: auth.user,
      action: 'SETTINGS_UPDATED',
      entityType: 'Settings',
      entityId: String(SETTINGS_ID),
      summary: `Einstellungen geändert. Bestellzeitraum: ${startAt?.toISOString() ?? 'offen'} bis ${endAt?.toISOString() ?? 'offen'}`,
    });
  } catch (error) {
    const errorId = logUnexpected('updateSettingsAction', error);
    return fail(`Speichern fehlgeschlagen. (Kennung ${errorId})`);
  }

  revalidatePath('/admin/settings');
  revalidatePath('/', 'layout');
  return OK;
}

// ---------------------------------------------------------------------------
// Benutzerverwaltung
// ---------------------------------------------------------------------------

export async function createUserAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const origin = await assertSameOrigin();
  if (!origin.ok) return fail(origin.message);

  const auth = await authorize(['ADMIN']);
  if (!auth.ok) return fail(auth.error);

  const parsed = userSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    role: formData.get('role'),
  });

  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  const password = passwordSchema.safeParse(formData.get('password'));
  if (!password.success) return fail(firstIssueMessage(password.error));

  try {
    const created = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        passwordHash: await hashPassword(password.data),
      },
      select: { id: true },
    });

    await recordAudit({
      actor: auth.user,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: created.id,
      summary: `Benutzer ${parsed.data.email} angelegt (Rolle ${parsed.data.role})`,
    });
  } catch (error) {
    if (isUniqueError(error)) return fail('Diese E-Mail-Adresse wird bereits verwendet.');
    const errorId = logUnexpected('createUserAction', error);
    return fail(`Anlegen fehlgeschlagen. (Kennung ${errorId})`);
  }

  revalidatePath('/admin/users');
  return OK;
}

const userActionSchema = z.object({
  userId: idSchema,
  operation: z.enum(['deactivate', 'activate', 'reset-totp']),
});

export async function modifyUserAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const origin = await assertSameOrigin();
  if (!origin.ok) return fail(origin.message);

  const auth = await authorize(['ADMIN']);
  if (!auth.ok) return fail(auth.error);

  const parsed = userActionSchema.safeParse({
    userId: formData.get('userId'),
    operation: formData.get('operation'),
  });

  if (!parsed.success) return fail('Ungültige Aktion.');

  // Sich selbst zu deaktivieren wäre der schnellste Weg, sich auszusperren.
  if (parsed.data.userId === auth.user.id && parsed.data.operation === 'deactivate') {
    return fail('Das eigene Konto kann nicht deaktiviert werden.');
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { email: true, role: true },
    });

    if (!target) return fail('Benutzer nicht gefunden.');

    switch (parsed.data.operation) {
      case 'deactivate': {
        // Letzten aktiven Admin nicht deaktivieren – sonst kommt niemand mehr rein.
        if (target.role === 'ADMIN') {
          const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
          if (activeAdmins <= 1) return fail('Der letzte aktive Admin kann nicht deaktiviert werden.');
        }

        await prisma.user.update({ where: { id: parsed.data.userId }, data: { isActive: false } });
        await destroyAllSessionsForUser(parsed.data.userId);

        await recordAudit({
          actor: auth.user,
          action: 'USER_DEACTIVATED',
          entityType: 'User',
          entityId: parsed.data.userId,
          summary: `Benutzer ${target.email} deaktiviert und abgemeldet`,
        });
        break;
      }

      case 'activate': {
        await prisma.user.update({
          where: { id: parsed.data.userId },
          data: { isActive: true, failedLoginAttempts: 0, lockedUntil: null },
        });

        await recordAudit({
          actor: auth.user,
          action: 'USER_UPDATED',
          entityType: 'User',
          entityId: parsed.data.userId,
          summary: `Benutzer ${target.email} aktiviert`,
        });
        break;
      }

      case 'reset-totp': {
        // Handy verloren: Secret und Notfallcodes weg, Einrichtung startet beim nächsten Login neu.
        await prisma.$transaction([
          prisma.user.update({
            where: { id: parsed.data.userId },
            data: { totpSecret: null, totpConfirmedAt: null },
          }),
          prisma.recoveryCode.deleteMany({ where: { userId: parsed.data.userId } }),
        ]);
        await destroyAllSessionsForUser(parsed.data.userId);

        await recordAudit({
          actor: auth.user,
          action: 'USER_TOTP_RESET',
          entityType: 'User',
          entityId: parsed.data.userId,
          summary: `Zweiter Faktor von ${target.email} zurückgesetzt`,
        });
        break;
      }
    }
  } catch (error) {
    const errorId = logUnexpected('modifyUserAction', error);
    return fail(`Aktion fehlgeschlagen. (Kennung ${errorId})`);
  }

  revalidatePath('/admin/users');
  return OK;
}

function isUniqueError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
