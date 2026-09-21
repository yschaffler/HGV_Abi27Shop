/**
 * Hilfsfunktionen für die Markdown-Ausgabe der Rechtstexte.
 *
 * Bewusst ohne React-Abhängigkeit, damit sie einzeln getestet werden können.
 */

/**
 * Protokolle, die in einem Link stehen dürfen.
 *
 * react-markdown filtert selbst schon gefährliche URLs heraus. Diese Liste ist die zweite,
 * explizite Schranke: Wer den Code liest, sieht ohne Blick in die Bibliothek, was erlaubt
 * ist. javascript: und data: sind damit auch dann ausgeschlossen, wenn sich das Verhalten
 * der Bibliothek einmal ändert.
 */
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

/** Gibt die URL zurück, wenn sie unbedenklich ist – sonst null. */
export function safeHref(href: string | undefined): string | null {
  if (!href) return null;

  // Relative Ziele (#anker, /pfad) bleiben innerhalb des Shops und sind unkritisch.
  if (href.startsWith('#') || href.startsWith('/')) return href;

  try {
    const url = new URL(href);
    return SAFE_PROTOCOLS.includes(url.protocol) ? href : null;
  } catch {
    return null;
  }
}

/**
 * Entfernt eine führende Überschrift der Ebene 1.
 *
 * Wer ein Impressum einträgt, schreibt oben meistens noch einmal "# Impressum". Die Seite
 * zeigt den Titel bereits als Überschrift an – ohne diesen Schritt stünde er zweimal da.
 * Überschriften weiter unten im Text bleiben unangetastet.
 */
export function stripLeadingHeading(markdown: string): string {
  const trimmed = markdown.trimStart();
  if (!trimmed.startsWith('# ')) return markdown;

  const lineBreak = trimmed.indexOf('\n');
  return lineBreak === -1 ? '' : trimmed.slice(lineBreak + 1).trimStart();
}
