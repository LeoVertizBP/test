import ConnectedDashboardContent from '@/components/dashboard/ConnectedDashboardContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Dashboard - Credit Compliance Tool',
  description: 'Real-time overview of scan jobs, flags, and compliance metrics with API integration',
};

export default function ConnectedDashboardPage() {
  return <ConnectedDashboardContent />;
}
