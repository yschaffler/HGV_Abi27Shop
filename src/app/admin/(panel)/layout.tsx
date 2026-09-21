import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AdminNav } from '@/components/admin/admin-nav';
import { LogoutButton } from '@/components/admin/logout-button';
import { getAuthenticatedUser } from '@/server/auth/rbac';

/**
 * Adminbereich mit Navigation. Ausschließlich für die Rolle ADMIN.
 *
 * Ein Ausgabe-Konto landet hier nicht auf einer Fehlerseite, sondern direkt in der
 * Ausgabeansicht – das ist die einzige Seite, für die es angelegt wurde.
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();

  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/admin/distribution');

  return (
    <div className="min-h-dvh">
      <header className="border-border bg-card border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-foreground font-semibold">
              Adminbereich
            </Link>
            <Link href="/" className="text-muted-foreground text-sm hover:underline">
              Shop ansehen
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:inline">{user.name}</span>
            <LogoutButton />
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-2">
          <AdminNav />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
