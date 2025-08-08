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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [preloadedData, setPreloadedData] = useState<unknown>(null);

  // Check for existing session on mount
  useEffect(() => {
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
    setIsAuthenticated(true);
    setUserRole(role);
    setPreloadedData(preloadedDataParam);
    
    // Set session to expire in 24 hours
    const expiryTime = new Date().getTime() + (24 * 60 * 60 * 1000);
    localStorage.setItem('golf-user-role', role);
    localStorage.setItem('golf-session-expiry', expiryTime.toString());
  };

  const logout = () => {
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