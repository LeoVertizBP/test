'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../services/auth/AuthContext';

// Add a new PublisherLayout component that will replace the entire app layout
export default function PublisherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  // Don't show the header/nav on the login page
  const isLoginPage = pathname === '/publisher/login';

  const handleLogout = () => {
    logout();
    router.push('/publisher/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Only display the publisher header (never the root layout's AppNavbar) */}
      {!isLoginPage && (
        <header className="bg-indigo-700 text-white">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold">Publisher Portal</h1>
                {user && <p className="text-sm opacity-80">{user.name}</p>}
              </div>
              <nav className="flex items-center space-x-6">
                <a 
                  href="/publisher/flags" 
                  className={`hover:underline ${pathname === '/publisher/flags' ? 'font-bold' : ''}`}
                >
                  Flags
                </a>
                <button 
                  onClick={handleLogout}
                  className="bg-indigo-900 hover:bg-indigo-800 px-3 py-1 rounded"
                >
                  Logout
                </button>
              </nav>
            </div>
          </div>
        </header>
      )}
      <main className="flex-grow container mx-auto px-4 py-4">
        {children}
      </main>
    </div>
  );
}
