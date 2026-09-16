import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { TotpSetupForm } from '@/components/auth/totp-setup-form';
import { getSessionContext } from '@/server/auth/session';
import { beginOrResumeTotpSetup } from '@/server/auth/totp-setup';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Zwei-Faktor einrichten', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function TotpSetupPage() {
  const context = await getSessionContext();
  if (!context) redirect('/login');
  if (context.user.totpConfirmed) redirect(context.totpVerified ? '/admin' : '/login/zwei-faktor');

  const settings = await getSettings();
  const setup = await beginOrResumeTotpSetup(context.user.id, settings.shopName);

  // QR-Code lokal erzeugen: kein externer Dienst bekommt das Secret zu sehen.
  const qrDataUrl = await QRCode.toDataURL(setup.uri, { margin: 1, width: 320 });

  return <TotpSetupForm qrDataUrl={qrDataUrl} manualKey={setup.manualKey} />;
}
