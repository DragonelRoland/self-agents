import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiService } from '../services/apiService';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  subscription?: {
    plan: string;
    status: string;
    maxRepositories: number;
    maxAnalysesPerMonth: number;
    repositoriesUsed: number;
    analysesThisMonth: number;
    currentPeriodEnd: string;
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (token: string) => {
    try {
      // Store token
      localStorage.setItem('authToken', token);
      
      // Set token in API service
      apiService.setAuthToken(token);
      
      // Fetch user data
      const userData = await apiService.getCurrentUser();
      setUser(userData.user);
    } catch (error) {
      console.error('Login failed:', error);
      logout();
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    apiService.clearAuthToken();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const userData = await apiService.getCurrentUser();
      setUser(userData.user);
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      logout();
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('authToken');
      
      if (token) {
        try {
          apiService.setAuthToken(token);
          const userData = await apiService.getCurrentUser();
          setUser(userData.user);
        } catch (error) {
          console.error('Failed to initialize auth:', error);
          logout();
        }
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  // Handle authentication callback from OAuth
  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      
      if (token) {
        try {
          await login(token);
          // Clear the token from URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('Auth callback failed:', error);
        }
      }
    };

    if (window.location.pathname === '/auth/callback') {
      handleAuthCallback();
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};