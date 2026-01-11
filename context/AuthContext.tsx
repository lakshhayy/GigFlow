import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { checkSession, logout } from '../services/mockApi';

interface AuthContextType {
  user: User | null;
  loginUser: (user: User) => void;
  logoutUser: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { user } = await checkSession();
        setUser(user);
      } catch (error) {
        // Not logged in or session expired
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const loginUser = (userData: User) => {
    setUser(userData);
  };

  const logoutUser = async () => {
    try {
      await logout();
    } catch (e) {
      console.error("Logout failed", e);
    }
    setUser(null);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, loginUser, logoutUser, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
