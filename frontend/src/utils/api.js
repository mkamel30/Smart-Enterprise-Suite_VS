import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// ===================== REQUEST INTERCEPTOR =====================

api.interceptors.request.use(
  (config) => {
    // Add CSRF token from cookie to headers
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('XSRF-TOKEN='))
      ?.split('=')[1];

    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    // Add auth token
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ===================== RESPONSE INTERCEPTOR =====================

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const response = error.response;

    if (response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (response?.status === 403) {
      // CSRF token invalid or insufficient permissions
      if (error.response?.data?.code === 'CSRF_VALIDATION_ERROR') {
        window.location.reload();
        return Promise.reject(error);
      }
      return Promise.reject(error);
    }

    if (response?.status === 429) {
      // Rate limit exceeded
      const retryAfter = response.data?.error?.retryAfter
