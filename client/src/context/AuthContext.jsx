import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [anonToken, setAnonToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Re-hydrate user from storage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('dwbs_user');
    const storedToken = localStorage.getItem('access_token');
    const storedAnon = sessionStorage.getItem('anon_token');

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
    }
    if (storedAnon) {
      setAnonToken(storedAnon);
    }
    setLoading(false);
  }, []);

  const staffLogin = useCallback(async (username, password, otp) => {
    const res = await api.post('/auth/login', { username, password, otp });
    const { access_token, refresh_token, user: userData } = res.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('dwbs_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const initAnonymousSession = useCallback(async (captchaToken) => {
    const res = await api.post('/auth/anonymous', { captcha_token: captchaToken });
    const { session_token, expires_at } = res.data;
    sessionStorage.setItem('anon_token', session_token);
    sessionStorage.setItem('anon_expires', expires_at);
    setAnonToken(session_token);
    return session_token;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('dwbs_user');
    setUser(null);
  }, []);

  const clearAnonSession = useCallback(() => {
    sessionStorage.removeItem('anon_token');
    sessionStorage.removeItem('anon_expires');
    setAnonToken(null);
  }, []);

  const isAuthenticated = !!user;
  const isAnonymous = !!anonToken && !user;

  const hasRole = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{
      user, anonToken, loading,
      isAuthenticated, isAnonymous,
      staffLogin, initAnonymousSession,
      logout, clearAnonSession, hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
