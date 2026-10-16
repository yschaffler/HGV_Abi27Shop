import 'server-only';

/**
 * Farben fuer die E-Mail-Vorlagen.
 *
 * Mailprogramme koennen kein Tailwind und keine CSS-Variablen – jede Farbe muss als Hex in
 * den style-Attributen stehen. Damit die Mails trotzdem nicht neben dem Shop stehen, liegen
 * die Werte hier an einer Stelle. Es sind dieselben Marken wie in globals.css:
 *
 *   navy   Stoff des Hoodies: Kopfzeile und Schaltflaechen
 *   creme  Druckfarbe des Prints: Schrift auf Navy
 *
 * Wie im Shop gibt es keinen dritten Akzent – zwei Farben, wie auf dem Pulli.
 *
 * Dunkelmodus gibt es hier bewusst nicht: Mailprogramme faerben HTML-Mails nach eigenen
 * Regeln um, und ein zweiter Satz Farben macht das Ergebnis nur unvorhersehbarer.
 */
export const MAIL_COLORS = {
  navy: '#0e1a36',
  navySoft: '#16233f',
  creme: '#f3ead8',
  cremeSoft: '#f9f8f6',
  /** Feine Linie auf Navy, Creme mit geringer Deckkraft. */
  navyLine: '#2b3651',
  /** Flaechen und Linien auf hellem Grund. */
  page: '#f1efe9',
  card: '#ffffff',
  line: '#dcd9d2',
  text: '#0e1a36',
  textMuted: '#5b6472',
} as const;
