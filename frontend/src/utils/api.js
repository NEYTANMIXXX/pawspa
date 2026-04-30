// ============================================================
// PawSpa — Cliente API (axios)
// ============================================================
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000/api',
  timeout: 15000,
});

// Interceptor: adjuntar token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pawspa_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor: manejar expiración de sesión
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pawspa_token');
      localStorage.removeItem('pawspa_usuario');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
