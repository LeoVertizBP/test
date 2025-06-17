'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../services/auth/AuthContext';
import { ROUTES } from '@/constants/routes';

interface RequireAuthProps {
  children: React.ReactNode;
}

/**
 * A component that restricts access to authenticated users only
 * Redirects to login page if user is not authenticated
 */
export default function RequireAuth({ children }: RequireAuthProps) {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If authentication check is complete and no token exists, redirect to login
    if (!isLoading && !token) {
      router.push(ROUTES.LOGIN);
    }
  }, [token, isLoading, router]);

  // If still loading, show nothing or a loading spinner
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="spinner h-12 w-12 border-4 border-t-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render children while redirecting
  if (!token) {
    return null;
  }

  // If authenticated, render children
  return <>{children}</>;
}
