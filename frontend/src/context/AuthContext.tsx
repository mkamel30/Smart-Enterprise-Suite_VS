import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../api/client';

interface User {
    id: string;
    email: string;
    displayName: string;
    role: string;
    branchId: string | null;
    branchType?: string;
    theme?: string;
    themeVariant?: 'glass' | 'solid';
    fontFamily?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        // Load from localStorage on mount
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
            // Verify token is still valid by making a quick API call
            api.setToken(storedToken);
            
            // Try to verify the token with a lightweight API call
            fetch('http://localhost:5000/api/notifications/count', {
                headers: { 'Authorization': `Bearer ${storedToken}` }
            })
            .then(res => {
                if (res.ok) {
                    // Token is valid, set state
                    setToken(storedToken);
                    setUser(JSON.parse(storedUser));
                } else {
                    // Token is invalid, clear localStorage
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    api.setToken(null);
                }
            })
            .catch(() => {
                // Network error or token invalid, clear localStorage
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                api.setToken(null);
            });
        }
    }, []);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        api.setToken(newToken);
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        api.setToken(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
