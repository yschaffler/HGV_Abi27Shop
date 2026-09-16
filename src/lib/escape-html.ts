/**
 * HTML-Escaping für Kontexte ohne React – konkret: E-Mail-Vorlagen.
 *
 * In der Weboberfläche übernimmt React das Escaping automatisch. E-Mails werden als
 * String zusammengebaut, deshalb muss jeder eingesetzte Wert hier durch.
 */
const REPLACEMENTS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => REPLACEMENTS[character] ?? character);
}
