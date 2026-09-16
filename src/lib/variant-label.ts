/**
 * Einheitliche Darstellung einer Variante – identisch in Shop, Admin, Ausgabe, Export und Mail.
 * Leere Felder werden weggelassen, damit eine Abi-Zeitung nicht als " · · " erscheint.
 */
export function variantLabel(parts: { color?: string | null; size?: string | null; label?: string | null }): string {
  const pieces = [parts.color, parts.size, parts.label]
    .map((piece) => piece?.trim())
    .filter((piece): piece is string => Boolean(piece));

  return pieces.length > 0 ? pieces.join(' · ') : 'Standard';
}
