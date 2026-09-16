import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { getAuthenticatedUser } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Anmeldung', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const NOTICES: Record<string, string> = {
  'keine-berechtigung': 'Für diesen Bereich fehlt die Berechtigung.',
  abgemeldet: 'Du wurdest abgemeldet.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Wer bereits angemeldet ist, braucht das Formular nicht.
  const user = await getAuthenticatedUser();
  if (user) redirect(user.role === 'DISTRIBUTION' ? '/admin/distribution' : '/admin');

  const query = await searchParams;
  const rawTarget = query['weiter'];
  const target = typeof rawTarget === 'string' && rawTarget.startsWith('/admin') ? rawTarget : '/admin';

  const rawNotice = query['fehler'];
  const notice = typeof rawNotice === 'string' ? (NOTICES[rawNotice] ?? null) : null;

  return <LoginForm redirectTo={target} notice={notice} />;
}
