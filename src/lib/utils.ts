import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Klassen zusammenfuehren – die Standard-Hilfsfunktion von shadcn/ui.
 *
 * clsx wertet Bedingungen aus, tailwind-merge entfernt anschliessend Widersprueche:
 * Aus "px-4 px-6" wird "px-6", statt dass beide im Markup stehen und die
 * Reihenfolge im Stylesheet entscheidet. Genau das braucht man, wenn eine Komponente
 * Standardklassen mitbringt und der Aufrufer einzelne davon ueberschreiben will.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
