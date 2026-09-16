'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/components/use-cart';

/**
 * Zwei kleine Seiteneffekte der Bestellseite:
 *
 * 1. Nach einer erfolgreichen Zahlung wird der Warenkorb im Browser geleert.
 * 2. Solange die Zahlung noch nicht bestätigt ist, wird die Seite ein paar Mal neu geladen.
 *    Der Stripe-Webhook braucht in der Regel nur Sekunden; ohne das müsste man manuell
 *    aktualisieren. Nach einigen Versuchen wird aufgehört – dauerpollen soll es nicht.
 */
export function OrderPageEffects({ paid, awaitingPayment }: { paid: boolean; awaitingPayment: boolean }) {
  const { clear } = useCart();
  const router = useRouter();
  const attempts = useRef(0);

  useEffect(() => {
    if (paid) clear();
  }, [paid, clear]);

  useEffect(() => {
    if (!awaitingPayment) return;

    const timer = window.setInterval(() => {
      attempts.current += 1;
      if (attempts.current > 8) {
        window.clearInterval(timer);
        return;
      }
      router.refresh();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [awaitingPayment, router]);

  return null;
}
