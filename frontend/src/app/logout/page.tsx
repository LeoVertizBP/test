'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../services/auth/AuthContext';

export default function LogoutPage() {
  const router = useRouter();
  const { logout } = useAuth();

  useEffect(() => {
    // Perform logout
    logout();
    
    // Redirect to login page
    setTimeout(() => {
      router.push('/login');
    }, 1000);
  }, [logout, router]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-center">
        <div className="text-xl mb-4">Logging out...</div>
        <div className="text-gray-500">You will be redirected to the login page.</div>
      </div>
    </div>
  );
}
