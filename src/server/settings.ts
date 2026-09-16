import 'server-only';
import { prisma } from './db';
import type { SettingsModel } from '@/generated/prisma/models';

/**
 * Die Einstellungen liegen in genau einer Zeile (id = 1). Ein Key-Value-Store waere
 * flexibler, aber untypisiert – bei einer Handvoll fester Felder ist das der schlechtere Tausch.
 */
export const SETTINGS_ID = 1;

const DEFAULT_PICKUP_INFO =
  'Die Artikel werden gesammelt beim Hersteller bestellt und anschliessend in der Schule ' +
  'an einem zentralen Ausgabepunkt verteilt. Es gibt keinen Versand an einzelne Personen. ' +
  'Den genauen Ausgabetermin geben wir rechtzeitig bekannt.';

const PLACEHOLDER = '[Vor dem Livegang ausfuellen – siehe LEGAL_CHECKLIST.md]';

export async function getSettings(): Promise<SettingsModel> {
  const existing = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;

  // Beim allerersten Start einmalig anlegen. Gleichzeitige Starts fangen wir ueber upsert ab.
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: {
      id: SETTINGS_ID,
      shopName: 'Abi-Shop',
      contactEmail: '',
      pickupInfo: DEFAULT_PICKUP_INFO,
      imprintText: PLACEHOLDER,
      privacyText: PLACEHOLDER,
      withdrawalText: PLACEHOLDER,
      termsText: PLACEHOLDER,
    },
  });
}

export async function getOrderWindow(): Promise<{ startAt: Date | null; endAt: Date | null; closedNotice: string | null }> {
  const settings = await getSettings();
  return {
    startAt: settings.orderStartAt,
    endAt: settings.orderEndAt,
    closedNotice: settings.closedNotice,
  };
}
