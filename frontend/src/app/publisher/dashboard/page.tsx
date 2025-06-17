'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PublisherDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect from the dashboard to the flags page
    router.replace('/publisher/flags');
  }, [router]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-xl">Redirecting to Flags...</div>
    </div>
  );
}
