import 'server-only';
import Stripe from 'stripe';
import { env } from '../env';

/**
 * Stripe-Client.
 *
 * Bewusst ohne explizite apiVersion: Das SDK sendet die API-Version, gegen die es generiert
 * wurde, und passt damit immer zu den mitgelieferten TypeScript-Typen. Eine händisch
 * gepflegte Versionsangabe wäre eine zusätzliche Stelle, die beim Update vergessen wird.
 *
 * Der Client wird erst beim ersten Zugriff erzeugt. So startet die Anwendung auch dann,
 * wenn Stripe (etwa in der Entwicklung) nicht konfiguriert ist – und scheitert erst dort,
 * wo Stripe tatsächlich gebraucht wird.
 */

let cached: Stripe | null = null;

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt).');
    this.name = 'StripeNotConfiguredError';
  }
}

export function stripe(): Stripe {
  if (cached) return cached;

  const secretKey = env().STRIPE_SECRET_KEY;
  if (!secretKey) throw new StripeNotConfiguredError();

  cached = new Stripe(secretKey, {
    // Automatische Wiederholung bei Netzwerkfehlern; Stripe nutzt dafür intern
    // Idempotenzschlüssel, sodass keine Doppelbuchungen entstehen.
    maxNetworkRetries: 2,
    timeout: 20_000,
  });

  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(env().STRIPE_SECRET_KEY);
}

/** Nur für Tests. */
export function resetStripeClientCache(): void {
  cached = null;
}
