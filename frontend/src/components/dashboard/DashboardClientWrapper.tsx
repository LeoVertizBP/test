'use client';

import RequireAuth from '@/components/auth/RequireAuth';
import ConnectedDashboardContent from '@/components/dashboard/ConnectedDashboardContent';

export default function DashboardClientWrapper() {
  return (
    <RequireAuth>
      <ConnectedDashboardContent />
    </RequireAuth>
  );
}
