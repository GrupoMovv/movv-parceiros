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
    const url = err.config?.url || '';
    // Rotas /public/* nunca usam movv_token pra autorizar (associado usa
    // apiPainel/seci_painel_token, parceiro IUB MAIS usa
    // apiParceiro/iub_mais_parceiro_token — ver comentários nesses
    // arquivos) — um 401 vindo de lá é SEMPRE erro de negócio (CPF/data
    // de nascimento errada, CNPJ indisponível etc.), nunca "sessão do
    // Portal Movv expirou". Sem esse filtro, qualquer 401 de negócio no
    // cadastro público de associado (ex.: data de nascimento não confere)
    // deslogava o Portal Movv e chutava a pessoa pra /login (a tela de
    // email+senha do Portal) no meio do fluxo público — bug relatado em
    // produção, reproduzido em /cadastrar no celular.
    const rotaPublica = url.startsWith('/public/') || url.startsWith('public/');
    if (err.response?.status === 401 && !rotaPublica) {
      console.warn(`[api] 401 em "${url}" — sessão do Portal Movv expirada, redirecionando pra /login.`);
      localStorage.removeItem('movv_token');
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Origem do backend (sem o "/api" final) — front e back vivem em domínios
// diferentes em produção.
export function backendOrigin() {
  return api.defaults.baseURL.replace(/\/api\/?$/, '');
}

// Resolve um path relativo do backend (ex.: "/uploads/associados/x.png",
// devolvido por endpoints que salvam arquivo em disco) pra URL absoluta.
export function assetUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${backendOrigin()}${path}`;
}

export default api;
