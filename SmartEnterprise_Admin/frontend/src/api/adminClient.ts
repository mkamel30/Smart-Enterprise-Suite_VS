import axios from 'axios';

const adminClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5005/api',
});

adminClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('portal_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default adminClient;
