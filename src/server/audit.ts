import 'server-only';
import { prisma } from './db';
import { logger } from './logger';

/**
 * Protokoll fuer Aktionen, die Geld, Berechtigungen oder Warenausgabe betreffen.
 *
 * Datensparsam: Akteur, Aktion, betroffene Entitaet und eine kurze Zusammenfassung.
 * Keine Request-Bodies, keine IP-Adressen, keine Kontaktdaten von Bestellern.
 */

export const AUDIT_ACTIONS = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DEACTIVATED',
  'USER_TOTP_RESET',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'VARIANT_CREATED',
  'VARIANT_UPDATED',
  'SETTINGS_UPDATED',
  'ORDER_PAYMENT_STATUS_CHANGED',
  'ORDER_FULFILLMENT_STATUS_CHANGED',
  'ORDER_NOTE_UPDATED',
  'ITEM_DISTRIBUTED',
  'ORDER_DISTRIBUTED_ALL',
  'EXPORT_DOWNLOADED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditActor = {
  id: string | null;
  email: string;
};

export async function recordAudit(params: {
  actor: AuditActor;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: params.actor.id,
        actorEmail: params.actor.email,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        summary: params.summary.slice(0, 1000),
      },
    });
  } catch (error) {
    // Ein fehlgeschlagenes Protokoll darf die eigentliche Aktion nicht ruecknehmen –
    // es wird aber laut geloggt, weil eine Luecke im Audit-Log relevant ist.
    logger.error('Audit-Eintrag konnte nicht geschrieben werden', {
      action: params.action,
      entityType: params.entityType,
      error,
    });
  }
}
