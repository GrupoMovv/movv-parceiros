import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BellRing, PauseCircle } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { EVENTO_PEDIDOS_MUDOU, INTERVALO_CAMPAINHA_MS, avisarPedidosMudou } from './campainha';

// Quantos pedidos esperam a loja aceitar ou recusar. Pergunta a cada 30 s, em
// qualquer aba do painel, e na hora quando um pedido muda (avisarPedidosMudou).
// Põe "(n) Novo pedido" no título da aba do navegador. Traz também se a loja
// foi pausada pelo sistema (A3: 2 pedidos seguidos sem resposta).
export function usePedidosEsperando(ativo) {
  const [esperando, setEsperando] = useState(0);
  const [pausaMotivo, setPausaMotivo] = useState(null);
  const [mudouEm, setMudouEm] = useState(null);

  useEffect(() => {
    if (!ativo) { setEsperando(0); setPausaMotivo(null); return undefined; }
    let vivo = true;
    const contar = () => apiParceiro.get('/parceiro/pedidos/contagem')
      .then(r => { if (vivo) { setEsperando(r.data.responder || 0); setPausaMotivo(r.data.pausa_motivo || null); setMudouEm(r.data.mudou_em || null); } })
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

  return { esperando, pausaMotivo, mudouEm };
}

// A3: faixa no topo do painel quando o sistema pausou os pedidos pelo site.
export function AvisoPausaExpirados({ pausaMotivo }) {
  const [salvando, setSalvando] = useState(false);
  if (pausaMotivo !== 'expirados') return null;
  async function voltar() {
    setSalvando(true);
    try {
      await apiParceiro.patch('/parceiro/pedidos/config/pausa', { pausado: false });
      toast.success('Pronto! Sua loja voltou a receber pedidos pelo site.');
      avisarPedidosMudou();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao voltar a receber');
    } finally {
      setSalvando(false);
    }
  }
  return (
    <div className="mb-6 rounded-2xl px-4 py-3 border bg-red-50 border-red-200 flex flex-wrap items-center gap-3" role="status">
      <PauseCircle className="w-5 h-5 text-red-700 shrink-0" />
      <p className="text-sm text-red-900 flex-1 min-w-[180px]">
        <strong>Pedidos pausados: 2 pedidos expiraram sem resposta.</strong>
        <span className="block text-xs mt-0.5">Os clientes veem só o seu WhatsApp. Volte a receber quando alguém puder responder em até 10 minutos.</span>
      </p>
      <button type="button" onClick={voltar} disabled={salvando}
        className="text-sm font-bold px-3 py-2 rounded-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
        Voltar a receber
      </button>
    </div>
  );
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
