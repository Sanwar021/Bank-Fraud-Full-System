import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, authApi } from '../api/auth';

interface AuthContextType {
  user: User | null;
  role: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<User>;
  logout: () => Promise<void>;
  loginAsDemo: (role: 'customer' | 'analyst' | 'teller' | 'admin') => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Remove tokens left by pre-cookie versions; authentication now uses HttpOnly cookies.
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    authApi.getMe()
      .then((userData) => {
        setUser(userData);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (email: string, pass: string): Promise<User> => {
    setIsLoading(true);
    try {
      const data = await authApi.login(email, pass);
      setUser(data.user);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  };

  const loginAsDemo = async (targetRole: 'customer' | 'analyst' | 'teller' | 'admin') => {
    const creds = {
      customer: { email: 'john.doe@bankinvestigation.com', pass: 'Password123!' },
      analyst: { email: 'analyst@bankinvestigation.com', pass: 'Analyst123!' },
      teller: { email: 'teller@bankinvestigation.com', pass: 'Teller123!' },
      admin: { email: 'admin@bankinvestigation.com', pass: 'Admin123!' },
    }[targetRole];

    await login(creds.email, creds.pass);
  };

  const refreshMe = async () => {
    try {
      const u = await authApi.getMe();
      setUser(u);
    } catch {
      // Ignored
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role_id ?? null,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        loginAsDemo,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

