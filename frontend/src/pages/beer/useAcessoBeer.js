import { useCallback, useEffect, useState } from 'react';
import apiPainel from '../../services/apiPainel';
import { CHAVE_SESSAO_IDADE } from './beerConfig';

function lerSessao() {
  try { return sessionStorage.getItem(CHAVE_SESSAO_IDADE) === '1'; } catch { return false; }
}
function gravarSessao() {
  try { sessionStorage.setItem(CHAVE_SESSAO_IDADE, '1'); } catch { /* aba anônima/bloqueada: pede de novo na próxima página */ }
}

// Porta +18 do IUB BEER. Estados:
//   'verificando' — perguntando pro backend (associado logado entra pelo cadastro)
//   'modal'       — precisa da autodeclaração (visitante, ou cadastro sem data)
//   'liberado'    — pode ver a área
//   'bloqueado'   — associado logado MENOR de idade pelo cadastro
// Usa apiPainel (não `api`) pra mandar o token da sessão do associado —
// mesmo motivo documentado em useAssociadoSessao. Já confirmado nesta aba
// (sessionStorage) = entra direto, sem nova chamada.
export function useAcessoBeer() {
  const [estado, setEstado] = useState(() => (lerSessao() ? 'liberado' : 'verificando'));

  useEffect(() => {
    if (estado !== 'verificando') return;
    apiPainel.post('/public/beer/registrar-acesso', {})
      .then(res => {
        if (res.data.is_adult === true) { gravarSessao(); setEstado('liberado'); }
        else if (res.data.is_adult === false) setEstado('bloqueado');
        else setEstado('modal');
      })
      .catch(() => setEstado('modal'));
  }, [estado]);

  // Checkbox marcada no modal. Se o log falhar (rede), libera do mesmo jeito:
  // a autodeclaração já aconteceu, travar um adulto por erro de rede não
  // protege ninguém.
  const confirmar = useCallback(async () => {
    try {
      const res = await apiPainel.post('/public/beer/registrar-acesso', { confirmado: true });
      if (res.data.is_adult === false) { setEstado('bloqueado'); return; }
    } catch { /* segue liberando */ }
    gravarSessao();
    setEstado('liberado');
  }, []);

  return { estado, confirmar };
}
