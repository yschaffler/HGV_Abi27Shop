import 'server-only';
import { prisma } from '../db';
import { formatCents } from '@/lib/money';
import { aggregateItems, AGGREGATE_PAYMENT_STATUSES, type AggregateRow } from './aggregate';
import { buildCsv, type CsvColumn } from './csv';
import { buildXlsx, type XlsxColumn } from './xlsx';

/**
 * Die beiden Exporte, die im Betrieb tatsächlich gebraucht werden:
 *
 *  - Sammelbestellung: eine Zeile je Variante mit der Gesamtmenge. Das ist die Liste,
 *    die beim Hersteller aufgegeben wird.
 *  - Detailliste: eine Zeile je Bestellposition, für Rückfragen und die Ausgabe auf Papier.
 *
 * Beide berücksichtigen ausschließlich bezahlte Bestellungen – unbezahltes wird nicht
 * beim Hersteller bestellt und nicht ausgegeben.
 */

export type ExportKind = 'aggregate' | 'details';
export type ExportFormat = 'csv' | 'xlsx';

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: 'Zahlung ausstehend',
  PAID: 'Bezahlt',
  FAILED: 'Fehlgeschlagen',
  REFUNDED: 'Erstattet',
  CANCELLED: 'Storniert',
};

const DISTRIBUTION_LABEL: Record<string, string> = {
  NOT_DISTRIBUTED: 'Nicht ausgegeben',
  DISTRIBUTED: 'Ausgegeben',
};

export async function loadAggregateRows(): Promise<AggregateRow[]> {
  const items = await prisma.orderItem.findMany({
    where: { order: { paymentStatus: { in: AGGREGATE_PAYMENT_STATUSES } } },
    select: {
      orderId: true,
      variantId: true,
      productName: true,
      variantLabel: true,
      color: true,
      size: true,
      quantity: true,
      unitPriceCents: true,
      lineTotalCents: true,
    },
  });

  return aggregateItems(items);
}

export type DetailRow = {
  orderNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  productName: string;
  variantLabel: string;
  color: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  paymentStatus: string;
  itemDistributionStatus: string;
  orderedAt: Date;
};

export async function loadDetailRows(): Promise<DetailRow[]> {
  const items = await prisma.orderItem.findMany({
    where: { order: { paymentStatus: { in: AGGREGATE_PAYMENT_STATUSES } } },
    orderBy: [{ order: { lastName: 'asc' } }, { order: { firstName: 'asc' } }, { productName: 'asc' }],
    select: {
      productName: true,
      variantLabel: true,
      color: true,
      size: true,
      quantity: true,
      unitPriceCents: true,
      lineTotalCents: true,
      distributionStatus: true,
      order: {
        select: {
          orderNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          paymentStatus: true,
          createdAt: true,
        },
      },
    },
  });

  return items.map((item) => ({
    orderNumber: item.order.orderNumber,
    firstName: item.order.firstName,
    lastName: item.order.lastName,
    email: item.order.email,
    productName: item.productName,
    variantLabel: item.variantLabel,
    color: item.color,
    size: item.size,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    lineTotalCents: item.lineTotalCents,
    paymentStatus: item.order.paymentStatus,
    itemDistributionStatus: item.distributionStatus,
    orderedAt: item.order.createdAt,
  }));
}

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Berlin',
});

const AGGREGATE_COLUMNS: Array<CsvColumn<AggregateRow> & XlsxColumn<AggregateRow>> = [
  { header: 'Produkt', width: 24, value: (row) => row.productName },
  { header: 'Farbe', width: 14, value: (row) => row.color },
  { header: 'Größe', width: 10, value: (row) => row.size },
  { header: 'Variante', width: 22, value: (row) => row.variantLabel },
  { header: 'Menge', width: 10, value: (row) => row.quantity },
  { header: 'Einzelpreis', width: 14, value: (row) => formatCents(row.unitPriceCents) },
  { header: 'Summe', width: 14, value: (row) => formatCents(row.totalCents) },
  { header: 'Bestellungen', width: 14, value: (row) => row.orderCount },
];

const DETAIL_COLUMNS: Array<CsvColumn<DetailRow> & XlsxColumn<DetailRow>> = [
  { header: 'Bestellnummer', width: 16, value: (row) => row.orderNumber },
  { header: 'Nachname', width: 18, value: (row) => row.lastName },
  { header: 'Vorname', width: 18, value: (row) => row.firstName },
  { header: 'E-Mail', width: 28, value: (row) => row.email },
  { header: 'Produkt', width: 24, value: (row) => row.productName },
  { header: 'Variante', width: 22, value: (row) => row.variantLabel },
  { header: 'Farbe', width: 14, value: (row) => row.color },
  { header: 'Größe', width: 10, value: (row) => row.size },
  { header: 'Menge', width: 8, value: (row) => row.quantity },
  { header: 'Einzelpreis', width: 14, value: (row) => formatCents(row.unitPriceCents) },
  { header: 'Summe', width: 14, value: (row) => formatCents(row.lineTotalCents) },
  { header: 'Zahlungsstatus', width: 20, value: (row) => PAYMENT_LABEL[row.paymentStatus] ?? row.paymentStatus },
  {
    header: 'Ausgabestatus',
    width: 18,
    value: (row) => DISTRIBUTION_LABEL[row.itemDistributionStatus] ?? row.itemDistributionStatus,
  },
  { header: 'Bestellt am', width: 18, value: (row) => DATE_FORMAT.format(row.orderedAt) },
];

export type ExportResult = {
  filename: string;
  contentType: string;
  body: Buffer;
  rowCount: number;
};

function timestamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function buildExport(kind: ExportKind, format: ExportFormat): Promise<ExportResult> {
  if (kind === 'aggregate') {
    const rows = await loadAggregateRows();

    if (format === 'csv') {
      return {
        filename: `sammelbestellung-${timestamp()}.csv`,
        contentType: 'text/csv; charset=utf-8',
        body: Buffer.from(buildCsv(rows, AGGREGATE_COLUMNS), 'utf8'),
        rowCount: rows.length,
      };
    }

    return {
      filename: `sammelbestellung-${timestamp()}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: await buildXlsx({ sheetName: 'Sammelbestellung', rows, columns: AGGREGATE_COLUMNS }),
      rowCount: rows.length,
    };
  }

  const rows = await loadDetailRows();

  if (format === 'csv') {
    return {
      filename: `bestellungen-detail-${timestamp()}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: Buffer.from(buildCsv(rows, DETAIL_COLUMNS), 'utf8'),
      rowCount: rows.length,
    };
  }

  return {
    filename: `bestellungen-detail-${timestamp()}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: await buildXlsx({ sheetName: 'Bestellungen', rows, columns: DETAIL_COLUMNS }),
    rowCount: rows.length,
  };
}
