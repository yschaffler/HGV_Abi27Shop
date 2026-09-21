import type { Metadata } from 'next';
import { CreateUserForm, UserOperationForm } from '@/components/admin/user-forms';
import { prisma } from '@/server/db';

export const metadata: Metadata = { title: 'Benutzer', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Berlin',
});

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  DISTRIBUTION: 'Ausgabe',
};

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      totpConfirmedAt: true,
      lastLoginAt: true,
      lockedUntil: true,
      _count: { select: { sessions: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl">Benutzer</h1>

      <div className="surface-card overflow-x-auto rounded-xl">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="border-border text-muted-foreground border-b text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Rolle</th>
              <th className="px-4 py-3 font-medium">2FA</th>
              <th className="px-4 py-3 font-medium">Letzter Login</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-border border-b last:border-0">
                <td className="px-4 py-3">
                  <p className="text-foreground font-medium">{user.name}</p>
                  <p className="text-muted-foreground text-xs break-all">{user.email}</p>
                </td>
                <td className="px-4 py-3">{ROLE_LABEL[user.role] ?? user.role}</td>
                <td className="px-4 py-3">
                  {user.totpConfirmedAt ? (
                    <span className="text-success-fg font-medium">aktiv</span>
                  ) : (
                    <span className="text-muted-foreground">nicht eingerichtet</span>
                  )}
                </td>
                <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                  {user.lastLoginAt ? DATE_FORMAT.format(user.lastLoginAt) : 'nie'}
                </td>
                <td className="px-4 py-3">
                  {!user.isActive ? (
                    <span className="text-muted-foreground">deaktiviert</span>
                  ) : user.lockedUntil && user.lockedUntil > new Date() ? (
                    <span className="text-gold-700 dark:text-gold-300 font-medium">gesperrt</span>
                  ) : (
                    <span className="text-success-fg font-medium">aktiv</span>
                  )}
                  <p className="text-muted-foreground text-xs">{user._count.sessions} offene Session(s)</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {user.isActive ? (
                      <UserOperationForm
                        userId={user.id}
                        operation="deactivate"
                        label="Deaktivieren"
                        confirmText={`${user.name} deaktivieren? Alle offenen Sessions werden sofort beendet.`}
                      />
                    ) : (
                      <UserOperationForm userId={user.id} operation="activate" label="Aktivieren" />
                    )}

                    {user.totpConfirmedAt ? (
                      <UserOperationForm
                        userId={user.id}
                        operation="reset-totp"
                        label="2FA zurücksetzen"
                        confirmText={`Zweiten Faktor von ${user.name} zurücksetzen? Die Einrichtung startet beim nächsten Login neu.`}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="surface-card rounded-xl p-5">
        <h2 className="text-lg">Neuen Benutzer anlegen</h2>
        <div className="mt-4">
          <CreateUserForm />
        </div>
      </section>
    </div>
  );
}
