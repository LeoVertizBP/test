import ReportsContent from '@/components/reports/ReportsContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reports - Credit Compliance Tool',
  description: 'Generate and view compliance reports and analysis',
};

export default function ReportsPage() {
  return <ReportsContent />;
}
