import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('movv_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('movv_token');
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Resolve um path relativo do backend (ex.: "/uploads/associados/x.png",
// devolvido por endpoints que salvam arquivo em disco) pra URL absoluta —
// front e back vivem em domínios diferentes em produção.
export function assetUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const base = api.defaults.baseURL.replace(/\/api\/?$/, '');
  return `${base}${path}`;
}

export default api;
