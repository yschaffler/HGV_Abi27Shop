/**
 * Farbpunkte für die Variantenauswahl.
 *
 * Rein kosmetisch. Die Farben sind im Datenmodell freie Texte, damit der Adminbereich
 * nicht bei jeder neuen Farbe eine Codeänderung braucht. Unbekannte Namen bekommen
 * deshalb einfach keinen Punkt, statt einen falschen zu zeigen.
 */
const SWATCHES: Record<string, string> = {
  schwarz: '#1a1a1a',
  weiss: '#f7f5ef',
  weiß: '#f7f5ef',
  creme: '#e8e0cd',
  natur: '#e5dcc5',
  grau: '#8b8b88',
  'hellgrau': '#c8c8c4',
  'dunkelgrau': '#4a4a48',
  anthrazit: '#3a3d3a',
  navy: '#1e2a44',
  dunkelblau: '#1e2a44',
  blau: '#2f5fa8',
  bordeaux: '#5c1a28',
  rot: '#a32a2a',
  oliv: '#6b7247',
  olive: '#6b7247',
  gruen: '#3f6b46',
  grün: '#3f6b46',
  beige: '#d9cdb4',
  sand: '#d4c4a3',
  rosa: '#d9a7b0',
  gold: '#c9a227',
};

export function colorSwatch(name: string): string | null {
  return SWATCHES[name.trim().toLowerCase()] ?? null;
}
