import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ChevronRight, ShoppingBag } from 'lucide-react';
import apiPainel from '../../../services/apiPainel';

const NAVY = '#0B1F3A';
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const COR_STATUS = {
  enviado: ['#FEF3C7', '#92400E'], aceito: ['#EDE9FE', '#5B21B6'], pago_saiu: ['#DBEAFE', '#1E40AF'],
  entregue: ['#DCFCE7', '#166534'], recusado: ['#FEE2E2', '#991B1B'], cancelado: ['#F1F5F9', '#475569'], expirado: ['#F1F5F9', '#475569'],
};
const ABERTOS = ['enviado', 'aceito', 'pago_saiu'];

function dataHora(iso) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`;
}

// /meu/pedidos — pedidos feitos pelo site (botão Comprar). Em andamento
// primeiro; cada um abre o acompanhamento (/meu/pedidos/:id).
export default function MeusPedidos() {
  const [pedidos, setPedidos] = useState(null);
  useEffect(() => {
    apiPainel.get('/public/pedidos').then(r => setPedidos(r.data.pedidos)).catch(() => setPedidos([]));
  }, []);

  if (!pedidos) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  const abertos = pedidos.filter(p => ABERTOS.includes(p.status));
  const encerrados = pedidos.filter(p => !ABERTOS.includes(p.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>Meus Pedidos</h1>
        <p className="text-slate-400 text-xs mt-1">Pedidos feitos pelo botão Comprar. O pagamento é por Pix, direto para a loja.</p>
      </div>
      {pedidos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
          <ShoppingBag className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-sm text-slate-500 mt-3">Você ainda não fez pedidos pelo site.</p>
          <Link to="/marketplace" className="inline-block mt-3 text-sm font-semibold underline" style={{ color: '#5B21B6' }}>Ver produtos</Link>
        </div>
      ) : (
        <>
          {abertos.length > 0 && <Grupo titulo="Em andamento" pedidos={abertos} />}
          {encerrados.length > 0 && <Grupo titulo="Anteriores" pedidos={encerrados} />}
        </>
      )}
    </div>
  );
}

function Grupo({ titulo, pedidos }) {
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">{titulo}</h2>
      {pedidos.map(p => {
        const [fundo, texto] = COR_STATUS[p.status] || COR_STATUS.cancelado;
        return (
          <Link key={p.id} to={`/meu/pedidos/${p.id}`} className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 p-4 hover:border-slate-300">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: NAVY }}>#{p.id} · {p.loja_nome}</p>
              <p className="text-xs text-slate-500 mt-0.5">{dataHora(p.created_at)} · {p.qtd_itens} {p.qtd_itens === 1 ? 'item' : 'itens'} · {brl(p.total)}</p>
              <span className="inline-block mt-2 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: fundo, color: texto }}>{p.status_texto}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}
