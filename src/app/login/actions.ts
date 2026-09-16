'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS, resetRateLimit } from '@/lib/rate-limit';
import { recordAudit } from '@/server/audit';
import { attemptLogin, consumeRecoveryCode, GENERIC_LOGIN_ERROR } from '@/server/auth/login';
import {
  destroyCurrentSession,
  getSessionContext,
  markSessionTotpVerified,
} from '@/server/auth/session';
import { confirmTotpSetup } from '@/server/auth/totp-setup';
import { verifyTotpCode } from '@/server/auth/totp';
import { prisma } from '@/server/db';
import { logUnexpected } from '@/server/logger';
import { clientIp } from '@/server/request-context';

/**
 * Anmelde-Actions.
 *
 * Alle Fehlermeldungen sind bewusst unspezifisch: Ob eine E-Mail-Adresse existiert, ob das
 * Passwort falsch war oder ob das Konto gesperrt ist, darf man an der Anmeldemaske nicht
 * unterscheiden können.
 */

export type LoginState = { status: 'idle' | 'error'; message?: string };

const credentialsSchema = z.object({
  email: z.string().trim().min(1).max(180),
  password: z.string().min(1).max(200),
});

/**
 * Ziel nach dem Login. Es werden ausschließlich eigene Admin-Pfade akzeptiert –
 * sonst wäre der Parameter ein offener Redirect auf beliebige fremde Seiten.
 */
function safeRedirectTarget(raw: FormDataEntryValue | null): string {
  const value = typeof raw === 'string' ? raw : '';
  if (!value.startsWith('/admin')) return '/admin';
  if (value.startsWith('//') || value.includes('\\')) return '/admin';
  return value;
}

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) return { status: 'error', message: GENERIC_LOGIN_ERROR };

  const ip = await clientIp();
  const emailKey = parsed.data.email.toLowerCase();

  // Zwei Limits: eins je Herkunft, eins je Konto. Das zweite bremst verteilte Versuche.
  const ipLimit = checkRateLimit(`login-ip:${ip}`, RATE_LIMITS.login);
  const accountLimit = checkRateLimit(`login-account:${emailKey}`, RATE_LIMITS.loginPerAccount);

  if (!ipLimit.allowed || !accountLimit.allowed) {
    const wait = Math.max(ipLimit.retryAfterSeconds, accountLimit.retryAfterSeconds);
    return {
      status: 'error',
      message: `Zu viele Anmeldeversuche. Bitte in ${Math.ceil(wait / 60)} Minuten erneut versuchen.`,
    };
  }

  let target = '/admin';

  try {
    const outcome = await attemptLogin(parsed.data.email, parsed.data.password);
    if (!outcome.ok) return { status: 'error', message: outcome.message };

    resetRateLimit(`login-account:${emailKey}`);

    switch (outcome.next) {
      case 'TOTP_SETUP':
        target = '/login/zwei-faktor-einrichten';
        break;
      case 'TOTP_VERIFY':
        target = '/login/zwei-faktor';
        break;
      case 'DONE':
        target = safeRedirectTarget(formData.get('weiter'));
        break;
    }
  } catch (error) {
    const errorId = logUnexpected('loginAction', error);
    return { status: 'error', message: `Anmeldung derzeit nicht möglich. (Kennung ${errorId})` };
  }

  redirect(target);
}

export type TotpState = { status: 'idle' | 'error'; message?: string };

const codeSchema = z.string().trim().min(6).max(20);

export async function verifyTotpAction(_previous: TotpState, formData: FormData): Promise<TotpState> {
  const context = await getSessionContext();
  if (!context) redirect('/login');
  if (context.totpVerified) redirect('/admin');

  const ip = await clientIp();
  const limit = checkRateLimit(`totp:${ip}:${context.user.id}`, RATE_LIMITS.loginPerAccount);
  if (!limit.allowed) {
    return { status: 'error', message: 'Zu viele Versuche. Bitte kurz warten.' };
  }

  const parsedCode = codeSchema.safeParse(formData.get('code'));
  if (!parsedCode.success) return { status: 'error', message: 'Bitte einen gültigen Code eingeben.' };

  const useRecoveryCode = formData.get('modus') === 'notfallcode';

  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: context.user.id },
      select: { totpSecret: true, email: true },
    });

    const accepted = useRecoveryCode
      ? await consumeRecoveryCode(context.user.id, parsedCode.data)
      : Boolean(user.totpSecret) && (await verifyTotpCode(user.totpSecret as string, parsedCode.data));

    if (!accepted) {
      await recordAudit({
        actor: { id: context.user.id, email: user.email },
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: context.user.id,
        summary: useRecoveryCode ? 'Notfallcode abgelehnt' : 'Zweiter Faktor abgelehnt',
      });
      return { status: 'error', message: 'Der Code stimmt nicht.' };
    }

    await markSessionTotpVerified(context.sessionId);

    await recordAudit({
      actor: { id: context.user.id, email: user.email },
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: context.user.id,
      summary: useRecoveryCode ? 'Anmeldung mit Notfallcode' : 'Anmeldung mit zweitem Faktor',
    });
  } catch (error) {
    const errorId = logUnexpected('verifyTotpAction', error);
    return { status: 'error', message: `Prüfung derzeit nicht möglich. (Kennung ${errorId})` };
  }

  redirect('/admin');
}

export type TotpSetupState =
  | { status: 'idle' | 'error'; message?: string }
  | { status: 'done'; recoveryCodes: string[] };

export async function confirmTotpSetupAction(
  _previous: TotpSetupState,
  formData: FormData,
): Promise<TotpSetupState> {
  const context = await getSessionContext();
  if (!context) redirect('/login');

  const parsedCode = codeSchema.safeParse(formData.get('code'));
  if (!parsedCode.success) return { status: 'error', message: 'Bitte den sechsstelligen Code eingeben.' };

  try {
    const result = await confirmTotpSetup(context.user.id, parsedCode.data);
    if (!result.ok) return { status: 'error', message: result.message };

    // Die Session gilt jetzt als vollständig authentifiziert.
    await markSessionTotpVerified(context.sessionId);

    return { status: 'done', recoveryCodes: result.recoveryCodes };
  } catch (error) {
    const errorId = logUnexpected('confirmTotpSetupAction', error);
    return { status: 'error', message: `Einrichtung derzeit nicht möglich. (Kennung ${errorId})` };
  }
}

export async function logoutAction(): Promise<never> {
  const context = await getSessionContext();

  if (context) {
    await recordAudit({
      actor: { id: context.user.id, email: context.user.email },
      action: 'LOGOUT',
      entityType: 'User',
      entityId: context.user.id,
      summary: 'Abmeldung',
    });
  }

  // Löscht die Session serverseitig UND das Cookie – ein gestohlenes Token ist danach wertlos.
  await destroyCurrentSession();
  redirect('/login');
}
