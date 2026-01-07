import { useState, useCallback } from 'react';
import api from '../utils/api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (email, password, branchId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', {
        identifier: email,
        email,
        password,
        branchId
      });

      const { token, user: userData } = response.data;

      // Store token securely
      localStorage.setItem('auth_token', token);
      setUser(userData);

      return { success: true, user: userData };
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || 'Login failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setUser(null);
  }, []);

  const getProfile = useCallback(async () => {
    try {
      const response = await api.get('/auth/profile');
      setUser(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch profile');
      return null;
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    setError(null);
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword: newPassword
      });
      return { success: true, message: response.data.message };
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to change password';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  return {
    user,
    loading,
    error,
    login,
    logout,
    getProfile,
    changePassword
  };
};
