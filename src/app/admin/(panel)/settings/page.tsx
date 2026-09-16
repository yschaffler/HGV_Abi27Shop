import type { Metadata } from 'next';
import { SettingsForm } from '@/components/admin/settings-form';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Einstellungen', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Wandelt einen gespeicherten Zeitpunkt (UTC) in den Wert um, den ein
 * <input type="datetime-local"> erwartet – und zwar in deutscher Ortszeit.
 * Ohne diese Umrechnung stünde im Formular je nach Jahreszeit eine oder zwei Stunden daneben.
 */
function toBerlinDateTimeLocal(value: Date | null): string {
  if (!value) return '';

  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(value);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '00';

  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl">Einstellungen</h1>

      <SettingsForm
        values={{
          shopName: settings.shopName,
          contactEmail: settings.contactEmail,
          orderStartAt: toBerlinDateTimeLocal(settings.orderStartAt),
          orderEndAt: toBerlinDateTimeLocal(settings.orderEndAt),
          closedNotice: settings.closedNotice ?? '',
          pickupInfo: settings.pickupInfo,
          imprintText: settings.imprintText,
          privacyText: settings.privacyText,
          withdrawalText: settings.withdrawalText,
          termsText: settings.termsText,
        }}
      />
    </div>
  );
}
