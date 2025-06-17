'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '../api/client';

interface AuthContextType {
  token: string | null;
  user: UserInfo | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserInfo | null>; // Return UserInfo or null
  logout: () => void;
  authError: string | null;
}

interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  publisherId?: string; // Add optional publisherId for publisher users
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();

  // Load token from localStorage on initial render
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
      try {
        // Parse the JWT token to get user info
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        
        // Enhanced debugging for publisherId
        console.log('Token payload:', {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
          organizationId: payload.organizationId,
          publisherId: payload.publisherId
        });
        
        if (payload.publisherId) {
          console.log('PublisherId details:', {
            value: payload.publisherId,
            type: typeof payload.publisherId,
            length: payload.publisherId.length,
            format: payload.publisherId.match(/^[0-9a-f-]+$/i) ? 'Valid UUID format' : 'Invalid UUID format',
            rawChars: Array.from(String(payload.publisherId)).map((c: string) => `${c}(${c.charCodeAt(0)})`).join(',')
          });
        }
        
        // Ensure publisherId is properly formatted if it exists
        let publisherId = undefined;
        if (payload.publisherId) {
          // Try to clean up the publisherId if needed
          publisherId = payload.publisherId.trim();
          // If it's not a valid UUID format, log a warning
          if (!publisherId.match(/^[0-9a-f-]+$/i)) {
            console.warn(`Publisher ID from token has invalid format: ${publisherId}`);
          }
        }
        
        // Build the user object with all fields from payload
        setUser({
          id: payload.userId,
          email: payload.email,
          name: payload.name || payload.email.split('@')[0], // Use name from payload if available
          role: payload.role,
          organizationId: payload.organizationId,
          // Include publisherId if it exists in the token
          ...(publisherId && { publisherId })
        });
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    }
    setIsLoading(false);
  }, []);

  // Login function
  const login = async (email: string, password: string): Promise<UserInfo | null> => { // Update return type
    try {
      setAuthError(null);
      setIsLoading(true);
      const response = await apiClient.post('/auth/login', { email, password });
      const { token, user } = response.data;

      // Ensure the user object from API response includes organizationId
      // The UserInfo type now expects it
      if (token && user && user.id && user.email && user.role && user.organizationId) {
        localStorage.setItem('authToken', token);
        setToken(token);
        // Ensure the name field is populated correctly if API sends first/last name
        const userInfo: UserInfo = {
            id: user.id,
            email: user.email,
            name: user.name || user.email.split('@')[0], // Use name from API or default
            role: user.role,
            organizationId: user.organizationId,
            // Add publisherId if present in the API response
            ...(user.publisherId && { publisherId: user.publisherId })
        };
        setUser(userInfo);
        return userInfo; // Return the user info object on success
      } else {
        setAuthError('Invalid response from server');
        return null; // Return null on failure
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setAuthError(error.response?.data?.message || 'Authentication failed. Please check your credentials.');
      return null; // Return null on failure
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout, authError }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook for using the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
