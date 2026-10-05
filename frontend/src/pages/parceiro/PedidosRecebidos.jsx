import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, ChevronLeft, Truck, Store } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, PRETO } from '../public/Marketplace/theme';
import PedidoLojaDetalhe, { brl } from '../../components/pedidos/PedidoLojaDetalhe';

const ABAS = [
  { id: 'responder', label: 'Para responder' },
  { id: 'andamento', label: 'Em andamento' },
  { id: 'encerrados', label: 'Encerrados' },
];

const COR_STATUS = {
  enviado: ['#FEF3C7', '#92400E'], aceito: ['#EDE9FE', '#5B21B6'], pago_saiu: ['#DBEAFE', '#1E40AF'],
  entregue: ['#DCFCE7', '#166534'], recusado: ['#FEE2E2', '#991B1B'], cancelado: ['#F1F5F9', '#475569'], expirado: ['#F1F5F9', '#475569'],
};

// Dois bipes curtos gerados no navegador (sem arquivo de som). O navegador só
// deixa tocar depois que a pessoa já clicou na página — no painel isso já
// aconteceu ao abrir a aba Pedidos.
function tocarAviso() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.25].forEach(inicio => {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      ganho.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
      ganho.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + inicio + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + 0.18);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + 0.2);
    });
    setTimeout(() => ctx.close(), 800);
  } catch { /* sem áudio: fica só o título */ }
}

function hora(iso) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`;
}

// /parceiro/painel/pedidos — pedidos pelo site que chegaram pra loja. Mesmas
// abas da agenda do PET. O detalhe e as ações são os mesmos do link sem login
// do aviso de WhatsApp (PedidoLojaDetalhe). "Para responder" se atualiza
// sozinho a cada 30s (pedido novo tem 10 min pra resposta).
export default function PedidosRecebidos() {
  const [aba, setAba] = useState('responder');
  const [dados, setDados] = useState(null);
  const [aberto, setAberto] = useState(null);
  const abaRef = useRef(aba);
  abaRef.current = aba;

  const [pendentes, setPendentes] = useState(0);
  const pendentesRef = useRef(null);

  // Pedido novo com o painel aberto (loja no computador): som curto + "(n)"
  // no título da aba do navegador — percebe sem olhar o WhatsApp.
  function conferirNovos(contagem) {
    const n = contagem?.responder || 0;
    if (pendentesRef.current !== null && n > pendentesRef.current) tocarAviso();
    pendentesRef.current = n;
    setPendentes(n);
  }

  function carregar(filtro = abaRef.current, silencioso = false) {
    if (!silencioso) setDados(null);
    apiParceiro.get('/parceiro/pedidos', { params: { filtro } })
      .then(r => { conferirNovos(r.data.contagem); if (filtro === abaRef.current) setDados(r.data); })
      .catch(() => { if (!silencioso) { toast.error('Erro ao carregar os pedidos'); setDados({ pedidos: [], contagem: {} }); } });
  }
  useEffect(() => { carregar(aba); setAberto(null); }, [aba]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // com um pedido aberto, só confere se chegou outro (não mexe na lista)
    const t = setInterval(() => {
      if (!aberto) carregar(abaRef.current, true);
      else apiParceiro.get('/parceiro/pedidos', { params: { filtro: 'responder' } }).then(r => conferirNovos(r.data.contagem)).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const original = document.title;
    if (pendentes > 0) document.title = `(${pendentes}) ${pendentes === 1 ? 'Novo pedido' : 'Novos pedidos'} · IUB MAIS+`;
    return () => { document.title = original; };
  }, [pendentes]);

  if (aberto) {
    return (
      <div className="max-w-md space-y-2">
        <button type="button" onClick={() => { setAberto(null); carregar(); }} className="flex items-center gap-1 text-sm font-semibold" style={{ color: ROXO }}>
          <ChevronLeft className="w-4 h-4" /> Voltar para a lista
        </button>
        <PedidoLojaDetalhe
          pedido={aberto}
          setPedido={setAberto}
          recarregar={() => apiParceiro.get(`/parceiro/pedidos/${aberto.id}`).then(r => setAberto(r.data)).catch(() => {})}
          executar={(acao, corpo) => apiParceiro.post(`/parceiro/pedidos/${aberto.id}/${acao}`, corpo).then(r => r.data)}
        />
      </div>
    );
  }

  const contagem = dados?.contagem || {};
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: PRETO }}>📦 Pedidos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Pedidos feitos pelo site. O cliente paga direto no seu Pix. Cada pedido novo também chega no seu WhatsApp com um link que abre aqui.
        </p>
      </div>
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit max-w-full overflow-x-auto">
        {ABAS.map(a => (
          <button key={a.id} type="button" onClick={() => setAba(a.id)}
            className={`text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap ${aba === a.id ? 'bg-white shadow' : 'text-slate-500'}`}
            style={aba === a.id ? { color: ROXO } : undefined}>
            {a.label}
            {a.id === 'responder' && contagem.responder > 0 ? ` (${contagem.responder})` : ''}
            {a.id === 'andamento' && contagem.andamento > 0 ? ` (${contagem.andamento})` : ''}
          </button>
        ))}
      </div>
      {!dados ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>
      ) : dados.pedidos.length === 0 ? (
        <div className="text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-100 py-10 px-4">
          {aba === 'responder' ? 'Nenhum pedido esperando resposta. Quando um cliente pedir pelo site, aparece aqui e você recebe o aviso no WhatsApp.'
            : aba === 'andamento' ? 'Nenhum pedido em andamento.' : 'Nenhum pedido encerrado ainda.'}
          {aba === 'responder' && <p className="mt-2"><Link to="/parceiro/painel/pedidos-site" className="font-semibold underline" style={{ color: ROXO }}>Configurar pedidos pelo site</Link></p>}
        </div>
      ) : (
        <div className="space-y-3">
          {dados.pedidos.map(p => <CardResumo key={p.id} p={p} onAbrir={() => setAberto(p)} />)}
        </div>
      )}
    </div>
  );
}

function CardResumo({ p, onAbrir }) {
  const [fundo, texto] = COR_STATUS[p.status] || COR_STATUS.cancelado;
  const qtd = p.itens.reduce((n, i) => n + i.quantidade, 0);
  const minutos = p.responder_ate ? Math.max(0, Math.ceil((new Date(p.responder_ate).getTime() - Date.now()) / 60000)) : null;
  return (
    <button type="button" onClick={onAbrir} className="w-full text-left bg-white rounded-2xl border border-slate-100 p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold" style={{ color: PRETO }}>#{p.id} · {p.cliente.nome}</p>
          <p className="text-xs text-slate-500 mt-0.5">{hora(p.created_at)} · {qtd} {qtd === 1 ? 'item' : 'itens'} · {brl(p.total)}</p>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: fundo, color: texto }}>{p.status_texto}</span>
      </div>
      <p className="text-xs text-slate-600 mt-2 flex items-center gap-1.5">
        {p.modo_recebimento === 'retirada' ? <Store className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
        {p.modo_recebimento === 'retirada' ? 'Retirada na loja' : `Entrega · ${p.endereco?.bairro || ''}`}
        {p.aviso_idade && <span className="ml-1 font-semibold text-amber-700">· 18+</span>}
      </p>
      {p.status === 'enviado' && (
        <p className={`text-xs font-semibold mt-2 ${p.prazo_esgotado ? 'text-slate-500' : minutos <= 2 ? 'text-red-600' : 'text-amber-700'}`}>
          {p.prazo_esgotado ? 'Prazo de resposta esgotado' : `Responda em até ${minutos} min`}
        </p>
      )}
    </button>
  );
}
