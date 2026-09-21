import Link from 'next/link';
import { LogoutButton } from '@/components/admin/logout-button';
import { requireDistributionAccess } from '@/server/auth/rbac';

/**
 * Eigenes Layout für die Ausgabe.
 *
 * Bewusst ohne Admin-Navigation: An der Ausgabe steht jemand mit einem iPad in der Hand und
 * einer Schlange davor. Auf dem Bildschirm soll nur stehen, was für den nächsten Handgriff
 * gebraucht wird – Suchfeld, Bestellung, große Knöpfe.
 */
export default async function DistributionLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDistributionAccess();

  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border bg-card sticky top-0 z-20 border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <h1 className="text-foreground text-lg font-semibold">Ausgabe</h1>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:inline">{user.name}</span>
            {user.role === 'ADMIN' ? (
              <Link href="/admin" className="btn-secondary h-9 px-3 text-sm">
                Adminbereich
              </Link>
            ) : null}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
    </div>
  );
}
