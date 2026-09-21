import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Auswahlliste auf Basis des nativen <select>.
 *
 * shadcn/ui bringt eine Radix-Variante mit, die deutlich mehr kann. Fuer eine Menge von
 * 1 bis 10 ist das native Element aber die bessere Wahl: Auf dem Telefon oeffnet es die
 * Systemauswahl, es funktioniert ohne JavaScript und es faellt nicht aus dem Layout.
 * Das Aussehen ist an Input angeglichen, damit es im Formular nicht auffaellt.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative inline-flex w-full">
      <select
        data-slot="native-select"
        className={cn(
          'border-input bg-card text-foreground h-10 w-full appearance-none rounded-md border py-2 pr-9 pl-3 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      />
    </div>
  );
}

export { NativeSelect };
