'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/services/auth/AuthContext';

const AppNavbar: React.FC = () => {
  // Auth context for user information and logout
  const { user, logout, token } = useAuth();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [activeNav, setActiveNav] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const navItems = [
    { href: ROUTES.DASHBOARD_CONNECTED, label: 'Dashboard' },
    { href: ROUTES.FLAG_REVIEW_CONNECTED, label: 'Flag Review' },
    { href: ROUTES.MANAGEMENT_CONNECTED, label: 'Management' },
    { href: ROUTES.REPORTS, label: 'Reports' },
  ];
  
  // Check if the current path belongs to a section
  const isInSection = (path: string, sectionPath: string): boolean => {
    return path === sectionPath || path.startsWith(`${sectionPath}/`);
  };
  
  // Handle navigation and show transition state
  const handleNavigation = (href: string) => {
    setActiveNav(href);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-surface border-b border-neutral-light">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link href={ROUTES.DASHBOARD_CONNECTED} className="text-secondary font-bold text-xl mr-10 hover:opacity-90 transition-opacity">
            CREDIT COMPLIANCE TOOL
          </Link>
          <nav className="hidden md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`px-4 py-2 mx-1 rounded-md transition-colors duration-200 text-sm font-medium ${
                  isInSection(pathname, item.href)
                    ? 'text-secondary border-b-2 border-secondary'
                    : 'text-text-secondary hover:text-text-primary'
                } ${isPending && activeNav === item.href ? 'opacity-70' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center">
          {token ? (
            <div className="relative" ref={dropdownRef}>
              <button 
                aria-label="User menu" 
                className="flex items-center text-text-primary hover:text-secondary"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className="mr-2 text-sm">{user?.name || 'User'}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 transition-transform duration-200 ${isDropdownOpen ? 'transform rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              
              {/* User dropdown menu */}
              <div className={`absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg py-1 z-10 ${isDropdownOpen ? 'block' : 'hidden'}`}>
                <div className="px-4 py-2 text-sm text-gray-700 border-b">
                  <p className="font-medium">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role?.toLowerCase()}</p>
                </div>
                
                
                <button
                  onClick={logout}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <Link href={ROUTES.LOGIN} className="text-text-primary hover:text-secondary text-sm">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppNavbar;
