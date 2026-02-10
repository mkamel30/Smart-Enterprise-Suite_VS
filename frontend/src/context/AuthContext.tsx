import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../api/client';

interface User {
    id: string;
    email: string;
    displayName: string;
    role: string;
    branchId: string | null;
    branchType?: string;
    authorizedBranchIds?: string[];
    theme?: string;
    themeVariant?: 'glass' | 'solid';
    fontFamily?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    activeBranchId: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    setActiveBranchId: (branchId: string | null) => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);

    // Wrapper to persist active branch selection
    const setActiveBranchId = (branchId: string | null) => {
        setActiveBranchIdState(branchId);
        if (branchId) {
            localStorage.setItem('activeBranchId', branchId);
        } else {
            localStorage.removeItem('activeBranchId');
        }
    };

    useEffect(() => {
        // Load from localStorage on mount
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        const storedActiveBranch = localStorage.getItem('activeBranchId');

        if (storedToken && storedUser) {
            // Verify token is still valid by making a quick API call
            api.setToken(storedToken);

            // Try to verify the token with a lightweight API call
            api.get('/notifications/count')
                .then(() => {
                    // Token is valid, set state
                    setToken(storedToken);
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);

                    // Set active branch (priority: stored > user's home branch)
                    if (storedActiveBranch) {
                        setActiveBranchIdState(storedActiveBranch);
                    } else if (parsedUser.branchId) {
                        setActiveBranchIdState(parsedUser.branchId);
                    }
                })
                .catch(() => {
                    // Token invalid or network error, clear localStorage
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    localStorage.removeItem('activeBranchId');
                    api.setToken(null);
                });
        }
    }, []);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        // Default active branch to user's home branch on login
        setActiveBranchIdState(newUser.branchId);

        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        if (newUser.branchId) {
            localStorage.setItem('activeBranchId', newUser.branchId);
        } else {
            localStorage.removeItem('activeBranchId');
        }
        api.setToken(newToken);
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        setActiveBranchIdState(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('activeBranchId');
        api.setToken(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, activeBranchId, setActiveBranchId, login, logout, isAuthenticated: !!token }}>
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
