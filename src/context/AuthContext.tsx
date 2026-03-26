import React, { createContext, useCallback, useContext, useState } from 'react';
import { auth as apiAuth, setAccessToken } from '../api/client';

type User = { id: string; email: string; name: string | null; role: string | null };

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isLoading: false,
  });

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const res = await apiAuth.login(email.trim(), password);
      setAccessToken(res.accessToken);
      setState({
        user: res.user,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        isLoading: false,
      });
    } finally {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
    });
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    isAuthenticated: !!state.accessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
