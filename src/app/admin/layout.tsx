import { requireUser, ROLES_WITH_DISTRIBUTION_ACCESS } from '@/server/auth/rbac';

/**
 * Äußerer Zugangsschutz für /admin/*.
 *
 * Hier wird nur geprüft, ob überhaupt ein angemeldeter Benutzer mit einer der beiden Rollen
 * vorliegt. Die feinere Prüfung (ADMIN vs. DISTRIBUTION) passiert in den jeweiligen
 * Unterlayouts und noch einmal in jeder Server Action – ein Layout allein ist kein
 * verlässlicher Schutz, weil Actions unabhängig vom Seitenaufbau aufgerufen werden können.
 */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  await requireUser(ROLES_WITH_DISTRIBUTION_ACCESS);
  return children;
}
