'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'admin' | 'viewer';

interface AuthContextType {
  isAuthenticated: boolean;
  userRole: UserRole | null;
  isLoading: boolean;
  preloadedData: unknown;
  login: (code: string, role: UserRole, preloadedData?: unknown) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

const isArchiveMode = process.env.NEXT_PUBLIC_ARCHIVE_MODE === 'true';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // The archive is a finished, read-only record. There is nothing here to
  // protect and nothing to edit, so it opens straight to the board rather than
  // asking for a code.
  const [isAuthenticated, setIsAuthenticated] = useState(isArchiveMode);
  const [userRole, setUserRole] = useState<UserRole | null>(isArchiveMode ? 'viewer' : null);
  const [isLoading, setIsLoading] = useState(!isArchiveMode);
  const [preloadedData, setPreloadedData] = useState<unknown>(null);

  // Check for existing session on mount
  useEffect(() => {
    if (isArchiveMode) return;
    const checkAuth = () => {
      const savedRole = localStorage.getItem('golf-user-role') as UserRole | null;
      const sessionExpiry = localStorage.getItem('golf-session-expiry');
      
      if (savedRole && sessionExpiry) {
        const now = new Date().getTime();
        const expiry = parseInt(sessionExpiry);
        
        if (now < expiry) {
          setIsAuthenticated(true);
          setUserRole(savedRole);
        } else {
          // Session expired, clear it
          localStorage.removeItem('golf-user-role');
          localStorage.removeItem('golf-session-expiry');
        }
      }
      
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = (code: string, role: UserRole, preloadedDataParam?: unknown) => {
    const resolvedRole: UserRole = isArchiveMode ? 'viewer' : role;
    setIsAuthenticated(true);
    setUserRole(resolvedRole);
    setPreloadedData(preloadedDataParam);
    
    // Set session to expire in 24 hours
    const expiryTime = new Date().getTime() + (24 * 60 * 60 * 1000);
    localStorage.setItem('golf-user-role', resolvedRole);
    localStorage.setItem('golf-session-expiry', expiryTime.toString());
  };

  const logout = () => {
    // There is no signing out of a public archive.
    if (isArchiveMode) return;
    setIsAuthenticated(false);
    setUserRole(null);
    setPreloadedData(null);
    localStorage.removeItem('golf-user-role');
    localStorage.removeItem('golf-session-expiry');
  };

  const value: AuthContextType = {
    isAuthenticated,
    userRole,
    isLoading,
    preloadedData,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
