import { useState, useContext, createContext, useEffect } from 'react';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [admin, setAdmin] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('portal_admin');
    const token = localStorage.getItem('portal_token');
    if (saved && token) {
      setAdmin(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  const login = (adminData: any, token: string) => {
    setAdmin(adminData);
    localStorage.setItem('portal_admin', JSON.stringify(adminData));
    localStorage.setItem('portal_token', token);
  };

  const logout = () => {
    setAdmin(null);
    localStorage.removeItem('portal_admin');
    localStorage.removeItem('portal_token');
  };

  return (
    <AuthContext.Provider value={{ admin, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
