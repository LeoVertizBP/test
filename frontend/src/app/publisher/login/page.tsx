'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../services/auth/AuthContext';

export default function PublisherLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, authError, token, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If already authenticated as a publisher, redirect to publisher interface
    if (token && user?.role === 'PUBLISHER') {
      router.push('/publisher/flags');
    } else if (token) {
      // If authenticated as a non-publisher, redirect to logout (security measure)
      // This prevents organization users from accessing publisher pages
      router.push('/logout');
    }
  }, [token, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Login function returns the user object if successful
      const loggedInUser = await login(email, password);

      if (loggedInUser) {
        // Only publishers can access publisher pages
        if (loggedInUser.role === 'PUBLISHER') {
          router.push('/publisher/flags');
        } else {
          // Prevent non-publishers from accessing publisher interface
          alert('This login is for publishers only.');
          router.push('/login'); // Redirect to regular login
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-indigo-700 mb-2">Publisher Portal</h1>
          <p className="text-gray-600">Sign in to access your flagged content</p>
        </div>

        {authError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 text-sm font-medium mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isLoading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Signing in...' : 'Publisher Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
