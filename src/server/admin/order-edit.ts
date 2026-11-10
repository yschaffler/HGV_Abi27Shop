import 'server-only';
import { prisma } from '../db';
import { recordAudit, type AuditActor } from '../audit';
import { deriveOrderDistributionStatus } from '../shop/distribution-status';
import { variantLabel } from '@/lib/variant-label';

/**
 * Nachträglich eine andere Variante (meist: Größe) für eine Bestellposition.
 *
 * Typischer Fall: Jemand hat in der Schule anprobiert und will statt M doch L. Damit danach
 * überall dasselbe steht – Sammelbestellung, Export, Statistik, Ausgabe, Bestellseite und
 * Mail –, wird die Position selbst umgeschrieben: Varianten-ID UND die Snapshot-Felder
 * (Farbe, Größe, Anzeigetext). Alle Auswertungen lesen genau diese Felder.
 *
 * Der Preis bleibt, was bezahlt wurde. Die Summe der Bestellung ändert sich also nie, und
 * der Abgleich mit Stripe passt weiterhin. Kostet die neue Variante im Katalog etwas
 * anderes, meldet das Ergebnis den Unterschied – ausgleichen muss man ihn außerhalb.
 *
 * Bei einer Position mit Menge > 1 lässt sich auch nur ein Teil umstellen (2 × M → 1 × M
 * und 1 × L). Gibt es in der Bestellung schon eine Position mit der neuen Variante zum
 * gleichen Preis, wird dorthin zusammengeführt statt eine zweite Zeile anzulegen.
 *
 * Ausgegebene Positionen sind gesperrt: Erst die Ausgabe zurücknehmen, dann ändern. Sonst
 * stünde im Protokoll, jemand habe eine Größe ausgegeben, die nie rausging.
 */

export type ChangeVariantOutcome =
  | {
      ok: true;
      summary: string;
      /** Katalogpreis der neuen Variante weicht vom bezahlten Preis ab (in Cent, neu − alt). */
      priceDifferenceCents: number;
      /** Die Sammelbestellung ist schon beim Hersteller – die Änderung muss dort nachgemeldet werden. */
      alreadyOrdered: boolean;
    }
  | { ok: false; message: string };

export async function changeOrderItemVariant(params: {
  itemId: string;
  newVariantId: string;
  /** Wie viele Stück der Position umgestellt werden; Standard: alle. */
  quantity?: number;
  actor: AuditActor;
}): Promise<ChangeVariantOutcome> {
  const item = await prisma.orderItem.findUnique({
    where: { id: params.itemId },
    select: {
      id: true,
      orderId: true,
      variantId: true,
      productName: true,
      variantLabel: true,
      unitPriceCents: true,
      quantity: true,
      distributionStatus: true,
      variant: { select: { productId: true } },
      order: { select: { orderNumber: true, fulfillmentStatus: true, paymentStatus: true } },
    },
  });

  if (!item) return { ok: false, message: 'Position nicht gefunden.' };

  if (item.distributionStatus === 'DISTRIBUTED') {
    return { ok: false, message: 'Diese Position ist schon ausgegeben. Erst die Ausgabe zurücknehmen, dann ändern.' };
  }

  if (item.order.paymentStatus === 'REFUNDED' || item.order.paymentStatus === 'CANCELLED') {
    return { ok: false, message: 'Erstattete oder stornierte Bestellungen lassen sich nicht mehr ändern.' };
  }

  if (params.newVariantId === item.variantId) {
    return { ok: false, message: 'Das ist bereits die gewählte Variante.' };
  }

  const target = await prisma.productVariant.findUnique({
    where: { id: params.newVariantId },
    select: {
      id: true,
      productId: true,
      color: true,
      size: true,
      label: true,
      priceCents: true,
      product: { select: { name: true } },
    },
  });

  // Nur innerhalb desselben Artikels: Aus einem Hoodie wird kein Shirt – das wäre ein
  // anderer Preis und eine neue Bestellung.
  if (!target || target.productId !== item.variant.productId) {
    return { ok: false, message: 'Diese Variante gehört nicht zu diesem Artikel.' };
  }

  const moveQuantity = params.quantity ?? item.quantity;
  if (!Number.isInteger(moveQuantity) || moveQuantity < 1 || moveQuantity > item.quantity) {
    return { ok: false, message: `Die Menge muss zwischen 1 und ${item.quantity} liegen.` };
  }

  const newLabel = variantLabel(target);
  const snapshot = {
    variantId: target.id,
    productName: target.product.name,
    variantLabel: newLabel,
    color: target.color,
    size: target.size,
  };

  const changed = await prisma.$transaction(async (tx) => {
    // Bedingt geschrieben: Hat jemand die Position inzwischen ausgegeben oder die Menge
    // geändert, greift die Änderung nicht.
    const guard = { id: item.id, distributionStatus: 'NOT_DISTRIBUTED' as const, quantity: item.quantity };

    const mergeInto = await tx.orderItem.findFirst({
      where: {
        orderId: item.orderId,
        variantId: target.id,
        unitPriceCents: item.unitPriceCents,
        distributionStatus: 'NOT_DISTRIBUTED',
        id: { not: item.id },
      },
      select: { id: true, quantity: true },
    });

    const remaining = item.quantity - moveQuantity;

    if (remaining === 0 && !mergeInto) {
      // Ganze Position umstellen – die Zeile bleibt, nur ihr Inhalt ändert sich.
      const updated = await tx.orderItem.updateMany({ where: guard, data: snapshot });
      if (updated.count === 0) return false;
    } else {
      // Quelle verkleinern oder ganz entfernen …
      const source =
        remaining === 0
          ? await tx.orderItem.deleteMany({ where: guard })
          : await tx.orderItem.updateMany({
              where: guard,
              data: { quantity: remaining, lineTotalCents: remaining * item.unitPriceCents },
            });
      if (source.count === 0) return false;

      // … und die Menge beim Ziel ergänzen.
      if (mergeInto) {
        const quantity = mergeInto.quantity + moveQuantity;
        await tx.orderItem.update({
          where: { id: mergeInto.id },
          data: { quantity, lineTotalCents: quantity * item.unitPriceCents },
        });
      } else {
        await tx.orderItem.create({
          data: {
            orderId: item.orderId,
            ...snapshot,
            unitPriceCents: item.unitPriceCents,
            quantity: moveQuantity,
            lineTotalCents: moveQuantity * item.unitPriceCents,
          },
        });
      }
    }

    // Zeilen können verschwinden oder hinzukommen – der Gesamtstatus folgt den Positionen.
    const items = await tx.orderItem.findMany({ where: { orderId: item.orderId }, select: { distributionStatus: true } });
    const status = deriveOrderDistributionStatus(items);
    await tx.order.update({
      where: { id: item.orderId },
      data: {
        distributionStatus: status,
        distributionCompletedAt: status === 'FULLY_DISTRIBUTED' ? new Date() : null,
      },
    });

    return true;
  });

  if (!changed) {
    return { ok: false, message: 'Die Position wurde gerade anderweitig geändert oder ausgegeben. Bitte Seite neu laden.' };
  }

  const summary = `${item.order.orderNumber}: ${moveQuantity} × ${item.productName} ${item.variantLabel} → ${newLabel}`;

  await recordAudit({
    actor: params.actor,
    action: 'ORDER_ITEM_CHANGED',
    entityType: 'Order',
    entityId: item.orderId,
    summary,
  });

  return {
    ok: true,
    summary,
    priceDifferenceCents: target.priceCents - item.unitPriceCents,
    alreadyOrdered: item.order.fulfillmentStatus !== 'NEW',
  };
}
