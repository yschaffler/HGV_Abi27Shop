import { Badge } from '@/components/ui/badge';
import type { OrderDistributionStatus, PaymentStatus } from '@/generated/prisma/enums';

/**
 * Status als Abzeichen.
 *
 * Die Farben sind bewusst gedeckt: "bezahlt" muss sich von "ausstehend" unterscheiden,
 * ohne dass die Seite zum Ampelbrett wird.
 */

type BadgeVariant = 'success' | 'warning' | 'neutral' | 'destructive';

const PAYMENT_STYLES: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Zahlung ausstehend', variant: 'warning' },
  PAID: { label: 'Bezahlt', variant: 'success' },
  FAILED: { label: 'Zahlung fehlgeschlagen', variant: 'destructive' },
  REFUNDED: { label: 'Erstattet', variant: 'neutral' },
  CANCELLED: { label: 'Storniert', variant: 'neutral' },
};

const DISTRIBUTION_STYLES: Record<OrderDistributionStatus, { label: string; variant: BadgeVariant }> = {
  NOT_DISTRIBUTED: { label: 'Noch nicht ausgegeben', variant: 'neutral' },
  PARTIALLY_DISTRIBUTED: { label: 'Teilweise ausgegeben', variant: 'warning' },
  FULLY_DISTRIBUTED: { label: 'Vollständig ausgegeben', variant: 'success' },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const style = PAYMENT_STYLES[status];
  return <Badge variant={style.variant}>{style.label}</Badge>;
}

export function DistributionStatusBadge({ status }: { status: OrderDistributionStatus }) {
  const style = DISTRIBUTION_STYLES[status];
  return <Badge variant={style.variant}>{style.label}</Badge>;
}
