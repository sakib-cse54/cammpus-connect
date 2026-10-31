import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { AuthUser, StudentProfile } from '../types.js';

interface AuthContextType {
  user: AuthUser | null;
  profile: StudentProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    try {
      if (!api.getToken()) {
        setLoading(false);
        return;
      }
      const data = await api.get<any>('/auth/me');
      if (data.user) {
        setUser({
          userId: data.user.id,
          email: data.user.email,
          role: data.user.role,
          fullName: data.profile?.full_name || data.user.email.split('@')[0],
          studentIdNumber: data.profile?.student_id_number
        });
        setProfile(data.profile);
      }
    } catch (err) {
      console.warn('Session verification failed, clearing auth:', err);
      api.setToken(null);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post<any>('/auth/login', { email, password });
    if (data.token) {
      api.setToken(data.token);
      setUser(data.user);
      await fetchCurrentUser();
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore logout network errors
    } finally {
      api.setToken(null);
      setUser(null);
      setProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, refreshUser: fetchCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
