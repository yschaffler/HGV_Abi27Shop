'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LockKeyholeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitAccessCodeAction, type AccessFormState } from '@/app/zugang/actions';

const INITIAL_STATE: AccessFormState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="gold" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Wird geprüft …' : 'Zum Shop'}
    </Button>
  );
}

export function AccessCodeForm({ hint }: { hint: string | null }) {
  const [state, formAction] = useActionState(submitAccessCodeAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="code" className="mb-2 text-white/80">
          <LockKeyholeIcon className="size-3.5" aria-hidden="true" />
          Zugangscode
        </Label>
        <Input
          id="code"
          name="code"
          required
          maxLength={64}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="z. B. ABI27"
          aria-invalid={state.status === 'error'}
          aria-describedby={state.status === 'error' ? 'code-fehler' : hint ? 'code-hinweis' : undefined}
          className="h-12 border-white/20 bg-white/5 text-center text-lg tracking-[0.3em] text-white uppercase placeholder:tracking-normal placeholder:text-white/30 focus-visible:border-white/40 focus-visible:ring-white/20"
        />
      </div>

      {state.status === 'error' && state.message ? (
        <p id="code-fehler" role="alert" className="text-gold-300 text-center text-sm font-medium">
          {state.message}
        </p>
      ) : null}

      <SubmitButton />

      {hint ? (
        <p id="code-hinweis" className="text-center text-xs text-white/50">
          {hint}
        </p>
      ) : null}
    </form>
  );
}
