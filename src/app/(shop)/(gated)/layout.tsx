import { redirect } from 'next/navigation';
import { readAccessState } from '@/server/shop/access';

/**
 * Zugangsschranke fuer den Bestellbereich.
 *
 * Die Pruefung sitzt bewusst im Layout einer Routengruppe und nicht in jeder Seite: Wer
 * spaeter eine Seite unter (gated) anlegt, bekommt die Schranke automatisch mit und kann
 * sie nicht vergessen.
 *
 * Absichtlich NICHT hinter der Schranke:
 *   - /rechtliches/* – Impressum und Datenschutzerklaerung muessen ohne Huerde erreichbar
 *     sein. Ein Zugangscode davor waere rechtlich riskant.
 *   - /bestellung/<token> – dort ist der Token das Zugangsmerkmal. Wer seine Bestaetigungs-
 *     mail oeffnet, soll nicht erst einen Code suchen muessen.
 *   - Adminbereich, Anmeldung und der Stripe-Webhook.
 */
export default async function GatedShopLayout({ children }: { children: React.ReactNode }) {
  const access = await readAccessState();

  if (access.required && !access.unlocked) {
    redirect('/zugang');
  }

  return children;
}
