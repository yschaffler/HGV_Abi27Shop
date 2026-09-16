'use client';

import { useState } from 'react';

/**
 * Aufklappbarer Abschnitt.
 *
 * Nutzt ein echtes <details>, dessen Zustand aber in React liegt. Beides ist nötig:
 *
 *  - <details> funktioniert auch ohne JavaScript. Ein rein React-gesteuertes Aufklappen
 *    würde Formulare unerreichbar machen, bevor die Seite hydriert ist.
 *  - Der Zustand in React sorgt dafür, dass der Abschnitt offen bleibt, wenn die Seite nach
 *    einer Server Action mit revalidatePath neu gerendert wird. Ein unkontrolliertes
 *    <details> klappt dabei zu und versteckt die Erfolgsmeldung des Formulars.
 */
export function Disclosure({
  summary,
  children,
  tone = 'default',
  defaultOpen = false,
}: {
  summary: string;
  children: React.ReactNode;
  tone?: 'default' | 'muted' | 'accent';
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const toneClass =
    tone === 'muted'
      ? 'text-muted text-xs'
      : tone === 'accent'
        ? 'text-sm font-medium text-brand-600'
        : 'text-strong text-sm font-semibold';

  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className={`cursor-pointer ${toneClass}`}>{summary}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
