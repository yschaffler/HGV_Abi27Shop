import 'server-only';
import ExcelJS from 'exceljs';

/**
 * XLSX-Erzeugung mit ExcelJS.
 *
 * Bewusst nicht das npm-Paket "xlsx": Das ist nicht der offiziell gepflegte
 * Distributionskanal von SheetJS und war mehrfach Gegenstand von Sicherheitsmeldungen.
 * ExcelJS deckt unseren Bedarf – eine Tabelle, fette Kopfzeile, sinnvolle Spaltenbreiten –
 * vollständig ab.
 *
 * Formeln sind hier kein Thema: ExcelJS schreibt Strings als Strings, nicht als Formeln.
 */

export type XlsxColumn<T> = {
  header: string;
  width: number;
  value: (row: T) => string | number | null | undefined;
};

export async function buildXlsx<T>(params: {
  sheetName: string;
  rows: readonly T[];
  columns: ReadonlyArray<XlsxColumn<T>>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  // Excel erlaubt in Blattnamen weder : \ / ? * [ ] noch mehr als 31 Zeichen.
  const sheet = workbook.addWorksheet(params.sheetName.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31));

  sheet.columns = params.columns.map((column) => ({ header: column.header, width: column.width }));

  for (const row of params.rows) {
    sheet.addRow(params.columns.map((column) => column.value(row) ?? ''));
  }

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: params.columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
