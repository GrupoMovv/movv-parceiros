import axios from 'axios';

// Instância própria (não a `api` padrão) porque o interceptor de `api`
// SEMPRE sobrescreve o header Authorization com o `movv_token` do portal
// quando ele existe no localStorage — isso quebraria a sessão do Meu
// Painel (que usa um JWT curto e diferente) em qualquer navegador onde o
// mesmo dispositivo também já foi usado pra logar como parceiro/admin.
const apiPainel = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

const TOKEN_KEY = 'seci_painel_token';

export function getPainelToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Evento global de "a sessão do associado mudou" — outras partes da árvore
// (ex.: CarrinhoContext, que precisa saber na hora quando migrar o
// carrinho local pro banco no login) escutam isso em vez de fazer polling
// ou depender de re-render por prop, já que login/logout costuma disparar
// de um componente totalmente separado.
function notificarMudancaSessao() {
  window.dispatchEvent(new Event('iub:sessao-associado-mudou'));
}

export function setPainelToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  notificarMudancaSessao();
}

apiPainel.interceptors.request.use(config => {
  const token = getPainelToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default apiPainel;
