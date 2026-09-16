import type { Metadata } from 'next';
import { DistributionDesk } from '@/components/distribution/distribution-desk';

export const metadata: Metadata = { title: 'Ausgabe', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function DistributionPage() {
  return <DistributionDesk />;
}
