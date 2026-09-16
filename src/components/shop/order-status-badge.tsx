import type { OrderDistributionStatus, PaymentStatus } from '@/generated/prisma/enums';

const PAYMENT_STYLES: Record<PaymentStatus, { label: string; className: string }> = {
  PENDING: { label: 'Zahlung ausstehend', className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  PAID: { label: 'Bezahlt', className: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200' },
  FAILED: { label: 'Zahlung fehlgeschlagen', className: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200' },
  REFUNDED: { label: 'Erstattet', className: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
  CANCELLED: { label: 'Storniert', className: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
};

const DISTRIBUTION_STYLES: Record<OrderDistributionStatus, { label: string; className: string }> = {
  NOT_DISTRIBUTED: { label: 'Noch nicht ausgegeben', className: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
  PARTIALLY_DISTRIBUTED: { label: 'Teilweise ausgegeben', className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  FULLY_DISTRIBUTED: { label: 'Vollständig ausgegeben', className: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200' },
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge {...PAYMENT_STYLES[status]} />;
}

export function DistributionStatusBadge({ status }: { status: OrderDistributionStatus }) {
  return <Badge {...DISTRIBUTION_STYLES[status]} />;
}
