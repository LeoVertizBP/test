import ConnectedManagementContent from '@/components/management/ConnectedManagementContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Management - Credit Compliance Tool',
  description: 'Manage publishers, products, rule sets, and system settings',
};

export default function ConnectedManagementPage() {
  return <ConnectedManagementContent />;
}
