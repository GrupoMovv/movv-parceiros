import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import apiPainel, { getPainelToken, setPainelToken } from '../../../services/apiPainel';

// Sessão do associado no Marketplace — usada em toda página pública que
// precisa saber "esse visitante é associado SECI ativo?" (Marketplace,
// ProdutoDetalhe, PromocaoDetalhe). Duas formas de entrar:
//   1. Automática: ?associado=hash na URL (link da carteirinha digital) —
//      troca o hash por uma sessão de verdade (token de 30 dias) e limpa a
//      URL, senão a "sessão" se perdia ao trocar de página.
//      Reaproveita o mesmo token do "Meu Painel" (apiPainel/painelPublicoAuth)
//      de propósito — mesma pessoa, mesma sessão, um token só.
//   2. Já logado: token de sessão salvo no localStorage de uma visita
//      anterior (login manual ou automático).
// Nunca usa a instância `api` padrão aqui — o interceptor dela sobrescreve
// o Authorization com o `movv_token` do portal interno e desloga em 401,
// o que corromperia essa sessão pública em qualquer navegador onde o mesmo
// dispositivo também logou como parceiro/admin.
export function useAssociadoSessao() {
  const [associado, setAssociado] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregarDoToken = useCallback(async () => {
    if (!getPainelToken()) { setAssociado(null); return; }
    try {
      const res = await apiPainel.get('/public/painel/me');
      setAssociado(res.data);
    } catch {
      setPainelToken(null);
      setAssociado(null);
    }
  }, []);

  useEffect(() => {
    async function iniciar() {
      setCarregando(true);
      const params = new URLSearchParams(window.location.search);
      const hash = params.get('associado');

      if (hash) {
        try {
          const res = await apiPainel.post('/public/cadastro/login-hash', { hash });
          setPainelToken(res.data.token);
          await carregarDoToken();
        } catch {
          toast.error('Carteirinha expirada ou inválida');
        } finally {
          // Some com o ?associado= da URL — a sessão já foi criada (ou não),
          // manter o hash exposto na barra de endereço não serve mais pra nada.
          params.delete('associado');
          const query = params.toString();
          window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));
        }
      } else {
        await carregarDoToken();
      }
      setCarregando(false);
    }
    iniciar();
  }, [carregarDoToken]);

  const logout = useCallback(() => {
    setPainelToken(null);
    setAssociado(null);
  }, []);

  return { associado, carregando, logout, recarregar: carregarDoToken };
}
