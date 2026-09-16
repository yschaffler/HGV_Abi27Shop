import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TotpForm } from '@/components/auth/totp-form';
import { getSessionContext } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Zweiter Faktor', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function TotpPage() {
  const context = await getSessionContext();

  // Ohne angefangene Anmeldung gibt es hier nichts zu tun.
  if (!context) redirect('/login');
  if (context.totpVerified) redirect('/admin');
  if (!context.user.totpConfirmed) redirect('/login/zwei-faktor-einrichten');

  return <TotpForm />;
}
