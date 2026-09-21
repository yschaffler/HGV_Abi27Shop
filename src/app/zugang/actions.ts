'use server';

import { redirect } from 'next/navigation';
import { assertSameOrigin, clientIp } from '@/server/request-context';
import { logUnexpected } from '@/server/logger';
import { readAccessState, unlockWithCode } from '@/server/shop/access';
import { accessCodeSchema } from '@/lib/validation/access';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export type AccessFormState = { status: 'idle' | 'error'; message?: string };

/**
 * Zugangscode pruefen.
 *
 * Reihenfolge wie ueberall im Projekt: Origin -> Rate Limit -> Zod -> Fachlogik. Das Rate
 * Limit ist hier der eigentliche Schutz: Ein kurzer Code hat wenig Entropie, ohne Bremse
 * waere er in Minuten durchprobiert.
 */
export async function submitAccessCodeAction(
  _previous: AccessFormState,
  formData: FormData,
): Promise<AccessFormState> {
  const origin = await assertSameOrigin();
  if (!origin.ok) return { status: 'error', message: origin.message };

  const ip = await clientIp();
  const limit = checkRateLimit(`access:${ip}`, RATE_LIMITS.accessCode);

  if (!limit.allowed) {
    return {
      status: 'error',
      message: `Zu viele Versuche. Bitte in ${Math.ceil(limit.retryAfterSeconds / 60)} Minuten erneut versuchen.`,
    };
  }

  const parsed = accessCodeSchema.safeParse(formData.get('code'));
  if (!parsed.success) {
    return { status: 'error', message: 'Der Code stimmt nicht.' };
  }

  try {
    const state = await readAccessState();
    if (!state.required) redirect('/');

    const unlocked = await unlockWithCode(parsed.data);
    if (!unlocked) {
      // Bewusst dieselbe Meldung wie bei einer ungueltigen Eingabe: Der Versuch soll nicht
      // verraten, woran genau es lag.
      return { status: 'error', message: 'Der Code stimmt nicht.' };
    }
  } catch (error) {
    // redirect() wirft intern eine spezielle Ausnahme – die darf nicht hier haengen bleiben.
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    if (typeof error === 'object' && error !== null && 'digest' in error) throw error;

    const errorId = logUnexpected('submitAccessCodeAction', error);
    return { status: 'error', message: `Das hat nicht geklappt. (Kennung ${errorId})` };
  }

  redirect('/');
}
