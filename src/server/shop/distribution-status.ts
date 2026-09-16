import type { ItemDistributionStatus, OrderDistributionStatus } from '@/generated/prisma/enums';

/**
 * Der Gesamtstatus einer Bestellung ergibt sich immer aus ihren Positionen.
 *
 * Die Funktion ist rein und wird sowohl beim Schreiben (innerhalb der Transaktion) als auch
 * in Tests verwendet. Dadurch kann der denormalisierte Wert in der Spalte
 * Order.distributionStatus nicht von der Wahrheit in den Positionen abweichen.
 */
export function deriveOrderDistributionStatus(
  items: ReadonlyArray<{ distributionStatus: ItemDistributionStatus }>,
): OrderDistributionStatus {
  if (items.length === 0) return 'NOT_DISTRIBUTED';

  const distributed = items.filter((item) => item.distributionStatus === 'DISTRIBUTED').length;

  if (distributed === 0) return 'NOT_DISTRIBUTED';
  if (distributed === items.length) return 'FULLY_DISTRIBUTED';
  return 'PARTIALLY_DISTRIBUTED';
}

export function distributionProgress(
  items: ReadonlyArray<{ distributionStatus: ItemDistributionStatus }>,
): { distributed: number; total: number; label: string } {
  const total = items.length;
  const distributed = items.filter((item) => item.distributionStatus === 'DISTRIBUTED').length;
  return { distributed, total, label: `${distributed} von ${total} Artikeln ausgegeben` };
}
