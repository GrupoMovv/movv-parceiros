import axios from 'axios';

// Instância própria (mesmo motivo do apiPainel.js) — o parceiro tem um JWT
// diferente do painel do associado e do portal interno; usar a instância
// `api` padrão sobrescreveria o header com o token errado.
const apiParceiro = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

const TOKEN_KEY = 'iub_mais_parceiro_token';

export function getParceiroToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setParceiroToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

apiParceiro.interceptors.request.use(config => {
  const token = getParceiroToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiParceiro.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      setParceiroToken(null);
    }
    return Promise.reject(err);
  }
);

export default apiParceiro;
