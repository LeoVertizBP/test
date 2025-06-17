'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import AppNavbar from './AppNavbar';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

/**
 * Client component that decides whether to show the navbar based on the current path
 */
export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const isPublisherPath = pathname?.startsWith('/publisher');
  
  return (
    <>
      {!isPublisherPath && (
        <Suspense fallback={<div className="h-16 bg-surface border-b border-neutral-light"></div>}>
          <AppNavbar />
        </Suspense>
      )}
      <main className={`flex-grow ${!isPublisherPath ? 'p-6' : ''}`}>
        {children}
      </main>
    </>
  );
}
