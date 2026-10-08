import { useEffect, useState } from 'react';
import apiPainel, { getPainelToken } from '../services/apiPainel';

// Aviso fixo pra conta de testador (marcada pelo admin, migration 086): a
// pessoa está vendo as lojas de teste. O estado vem de useAssociadoSessao;
// em página que não usa a sessão (ex.: página da loja aberta direto por
// link) o próprio aviso confere uma vez por aba.
function lido() {
  try { return sessionStorage.getItem('iub_modo_teste'); } catch { return null; }
}

export default function ModoTesteAviso() {
  const [ativo, setAtivo] = useState(() => lido() === '1');
  useEffect(() => {
    const atualizar = () => setAtivo(lido() === '1');
    window.addEventListener('iub:modo-teste', atualizar);
    if (lido() === null && getPainelToken()) {
      apiPainel.get('/public/painel/me')
        .then(r => {
          try { sessionStorage.setItem('iub_modo_teste', r.data?.modo_teste ? '1' : '0'); } catch { /* sem storage */ }
          atualizar();
        })
        .catch(() => {});
    }
    return () => window.removeEventListener('iub:modo-teste', atualizar);
  }, []);
  if (!ativo) return null;
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg bg-amber-400 text-amber-950">
        🧪 Modo teste: você está vendo as lojas de teste
      </span>
    </div>
  );
}
