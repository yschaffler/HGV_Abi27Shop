/**
 * CSV-Erzeugung nach RFC 4180 – mit Schutz vor CSV-Injection.
 *
 * Der eigentliche Grund für eigenen Code statt einer Bibliothek: Excel und LibreOffice
 * interpretieren Zellen, die mit =, +, -, @, Tab oder CR beginnen, als FORMEL. Ein Besteller,
 * der sich "=HYPERLINK(...)" als Nachnamen einträgt, würde sonst beim Öffnen des Exports
 * Code in der Tabelle des Admins ausführen. Deshalb wird solchen Werten ein Apostroph
 * vorangestellt. Das macht keine der üblichen CSV-Bibliotheken von sich aus.
 */

const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

export function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';

  let text = String(value);

  if (FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    text = `'${text}`;
  }

  // Anführungszeichen verdoppeln, Feld einpacken, sobald es Sonderzeichen enthält.
  if (/["\n\r;,]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

/**
 * Trennzeichen ist das Semikolon: Excel in deutscher Spracheinstellung erwartet das,
 * sonst landet die ganze Zeile in einer Spalte.
 *
 * Das BOM am Anfang sorgt dafür, dass Excel die Datei als UTF-8 erkennt und Umlaute
 * nicht zerschossen darstellt.
 */
export function buildCsv<T>(rows: readonly T[], columns: ReadonlyArray<CsvColumn<T>>): string {
  const lines = [columns.map((column) => escapeCsvValue(column.header)).join(';')];

  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvValue(column.value(row))).join(';'));
  }

  return `﻿${lines.join('\r\n')}\r\n`;
}
