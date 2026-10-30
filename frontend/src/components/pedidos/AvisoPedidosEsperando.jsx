import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { EVENTO_PEDIDOS_MUDOU, INTERVALO_CAMPAINHA_MS } from './campainha';

// Quantos pedidos esperam a loja aceitar ou recusar. Pergunta a cada 30 s, em
// qualquer aba do painel, e na hora quando um pedido muda (avisarPedidosMudou).
// Põe "(n) Novo pedido" no título da aba do navegador.
export function usePedidosEsperando(ativo) {
  const [esperando, setEsperando] = useState(0);

  useEffect(() => {
    if (!ativo) { setEsperando(0); return undefined; }
    let vivo = true;
    const contar = () => apiParceiro.get('/parceiro/pedidos/contagem')
      .then(r => { if (vivo) setEsperando(r.data.responder || 0); })
      .catch(() => {});
    contar();
    const t = setInterval(contar, INTERVALO_CAMPAINHA_MS);
    window.addEventListener(EVENTO_PEDIDOS_MUDOU, contar);
    return () => { vivo = false; clearInterval(t); window.removeEventListener(EVENTO_PEDIDOS_MUDOU, contar); };
  }, [ativo]);

  useEffect(() => {
    if (esperando <= 0) return undefined;
    const original = document.title;
    document.title = `(${esperando}) ${esperando === 1 ? 'Novo pedido' : 'Novos pedidos'} · IUB MAIS+`;
    return () => { document.title = original; };
  }, [esperando]);

  return esperando;
}

// Faixa no topo do painel enquanto houver pedido esperando resposta.
export default function AvisoPedidosEsperando({ esperando, campainha, naPaginaDePedidos }) {
  if (esperando <= 0) return null;
  return (
    <div className="mb-6 rounded-2xl px-4 py-3 border bg-amber-50 border-amber-300 flex flex-wrap items-center gap-3" role="status">
      <BellRing className="w-5 h-5 text-amber-700 shrink-0 animate-pulse" />
      <p className="text-sm font-bold text-amber-900 flex-1 min-w-[180px]">
        {esperando === 1 ? '1 pedido esperando' : `${esperando} pedidos esperando`} você aceitar ou recusar
        {campainha.bloqueada && (
          <span className="block text-xs font-medium text-amber-800 mt-0.5">
            O navegador só deixa a campainha tocar depois de um toque na página.
          </span>
        )}
      </p>
      {campainha.bloqueada && (
        <button type="button" onClick={campainha.ativar}
          className="text-sm font-bold px-3 py-2 rounded-xl text-white bg-amber-600 hover:bg-amber-700">
          🔔 Ativar campainha
        </button>
      )}
      {!naPaginaDePedidos && (
        <Link to="/parceiro/painel/pedidos" className="text-sm font-bold px-3 py-2 rounded-xl text-white bg-violet-700">
          {esperando === 1 ? 'Ver pedido' : 'Ver pedidos'}
        </Link>
      )}
    </div>
  );
}
