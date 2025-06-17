'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/constants/routes';

export default function DashboardRedirectPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the connected version
    router.replace(ROUTES.DASHBOARD_CONNECTED);
  }, [router]);

  return (
    <div className="flex justify-center items-center h-screen">
      <p className="text-text-secondary">Redirecting to Dashboard...</p>
    </div>
  );
}
