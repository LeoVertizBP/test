'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/constants/routes';

export default function FlagReviewRedirectPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the connected version
    router.replace(ROUTES.FLAG_REVIEW_CONNECTED);
  }, [router]);

  return (
    <div className="flex justify-center items-center h-screen">
      <p className="text-text-secondary">Redirecting to Flag Review...</p>
    </div>
  );
}
