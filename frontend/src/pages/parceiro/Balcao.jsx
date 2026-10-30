import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Store, Truck, Loader2, ArrowLeft, BellRing, WifiOff } from 'lucide-react';
import apiParceiro, { getParceiroToken } from '../../services/apiParceiro';
import { brl } from '../../components/pedidos/PedidoLojaDetalhe';
import { useCampainha, INTERVALO_CAMPAINHA_MS } from '../../components/pedidos/campainha';

// /parceiro/painel/balcao — modo balcão (A4): tela cheia só com os pedidos
// abertos, para deixar aberta no computador do caixa. Sem o menu do painel.
// Atualiza a cada 30 s, toca a campainha (A1) enquanto houver pedido
// esperando resposta e pede ao navegador para não apagar a tela.
const COLUNAS = [
  { id: 'enviado', titulo: 'Esperando resposta', cor: '#B45309', fundo: '#FFFBEB' },
  { id: 'aceito', titulo: 'Aguardando Pix', cor: '#5B21B6', fundo: '#F5F3FF' },
  { id: 'pago_saiu', titulo: 'Pago / saiu', cor: '#1E40AF', fundo: '#EFF6FF' },
];

function useTelaAcesa() {
  const [acesa, setAcesa] = useState(false);
  useEffect(() => {
    let trava = null;
    let vivo = true;
    async function pedir() {
      try {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
        trava = await navigator.wakeLock.request('screen');
        if (!vivo) { trava.release(); return; }
        setAcesa(true);
        trava.addEventListener('release', () => setAcesa(false));
      } catch { setAcesa(false); }
    }
    pedir();
    // o navegador solta a trava quando a aba some; pede de novo ao voltar
    const aoVoltar = () => { if (document.visibilityState === 'visible') pedir(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { vivo = false; document.removeEventListener('visibilitychange', aoVoltar); trava?.release().catch(() => {}); };
  }, []);
  return acesa;
}

export default function Balcao() {
  const [pedidos, setPedidos] = useState(null);
  const [loja, setLoja] = useState(null);
  const [problema, setProblema] = useState(null); // 'login' | 'rede'
  // o WhatsApp automático do cliente falhou: a loja manda pelo celular dela
  const [manuais, setManuais] = useState([]);
  const [agora, setAgora] = useState(Date.now());
  const telaAcesa = useTelaAcesa();

  const carregar = useCallback(async () => {
    if (!getParceiroToken()) { setProblema('login'); return; }
    try {
      const [a, b] = await Promise.all([
        apiParceiro.get('/parceiro/pedidos', { params: { filtro: 'responder' } }),
        apiParceiro.get('/parceiro/pedidos', { params: { filtro: 'andamento' } }),
      ]);
      setPedidos([...a.data.pedidos, ...b.data.pedidos]);
      setProblema(null);
    } catch (err) {
      setProblema(err.response?.status === 401 ? 'login' : 'rede');
    }
  }, []);

  useEffect(() => {
    apiParceiro.get('/parceiro/auth/me').then(r => setLoja(r.data.parceiro)).catch(() => {});
    carregar();
    const t = setInterval(carregar, INTERVALO_CAMPAINHA_MS);
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(relogio); };
  }, [carregar]);

  const esperando = (pedidos || []).filter(p => p.status === 'enviado');
  const campainha = useCampainha(esperando.length > 0 && problema !== 'login');

  useEffect(() => {
    const original = document.title;
    document.title = esperando.length > 0 ? `(${esperando.length}) Balcão · IUB MAIS+` : 'Balcão · IUB MAIS+';
    return () => { document.title = original; };
  }, [esperando.length]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
        <Link to="/parceiro/painel/pedidos" className="flex items-center gap-1 text-sm font-semibold text-slate-500">
          <ArrowLeft className="w-4 h-4" /> Painel
        </Link>
        <h1 className="text-lg sm:text-2xl font-black text-slate-900 flex-1 min-w-0 truncate">
          Balcão{loja?.nome ? ` · ${loja.nome}` : ''}
        </h1>
        <span className="text-xl sm:text-3xl font-black tabular-nums text-slate-900">
          {new Date(agora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
        </span>
        {campainha.bloqueada && (
          <button type="button" onClick={campainha.ativar} className="text-sm font-bold px-3 py-2 rounded-xl text-white bg-amber-600">
            🔔 Ativar campainha
          </button>
        )}
      </header>

      {problema === 'login' && (
        <div className="bg-red-600 text-white px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3" role="alert">
          <p className="text-lg font-bold flex-1">O login caiu. Os pedidos novos não aparecem nem tocam até você entrar de novo.</p>
          <Link to="/entrar?voltar=/parceiro/painel/balcao" className="px-4 py-2 rounded-xl bg-white text-red-700 font-bold">Entrar de novo</Link>
        </div>
      )}
      {problema === 'rede' && (
        <div className="bg-red-600 text-white px-4 sm:px-6 py-3 flex items-center gap-2 text-lg font-bold" role="alert">
          <WifiOff className="w-6 h-6" /> Sem conexão com o IUB MAIS+. Tentando de novo a cada 30 segundos.
        </div>
      )}

      {manuais.map(m => (
        <div key={m.id} className="bg-amber-100 border-b border-amber-300 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3" role="alert">
          <p className="text-base font-bold text-amber-900 flex-1">O cliente do pedido #{m.id} não recebeu o aviso no WhatsApp.</p>
          <a href={m.link} target="_blank" rel="noreferrer" onClick={() => setManuais(x => x.filter(y => y.id !== m.id))}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold">Mandar pelo meu WhatsApp</a>
        </div>
      ))}

      {!pedidos && !problema ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-violet-700" /></div>
      ) : (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 sm:p-6">
          {COLUNAS.map(col => {
            const lista = (pedidos || []).filter(p => p.status === col.id);
            return (
              <section key={col.id} className="rounded-2xl p-3 sm:p-4 flex flex-col gap-3" style={{ backgroundColor: col.fundo }}>
                <h2 className="text-lg sm:text-xl font-black flex items-center gap-2" style={{ color: col.cor }}>
                  {col.id === 'enviado' && lista.length > 0 && <BellRing className="w-6 h-6 animate-pulse" />}
                  {col.titulo} <span className="ml-auto text-2xl">{lista.length}</span>
                </h2>
                {lista.length === 0 && <p className="text-base text-slate-400 py-6 text-center">Nenhum</p>}
                {lista.map(p => (
                  <CartaoBalcao key={p.id} p={p} agora={agora} aoMudar={carregar}
                    aoFalharAviso={link => setManuais(x => [...x.filter(y => y.id !== p.id), { id: p.id, link }])} />
                ))}
              </section>
            );
          })}
        </main>
      )}

      <footer className="px-4 sm:px-6 py-2 text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
        <span>Atualiza sozinho a cada 30 segundos.</span>
        <span>{telaAcesa ? '💡 A tela fica acesa enquanto esta página estiver aberta.' : 'Deixe o computador sem descanso de tela para não perder pedido.'}</span>
      </footer>
    </div>
  );
}

function CartaoBalcao({ p, agora, aoMudar, aoFalharAviso }) {
  const [agindo, setAgindo] = useState(null);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState(null);
  const montado = useRef(true);
  useEffect(() => () => { montado.current = false; }, []);

  async function agir(acao, corpo = {}) {
    setAgindo(acao); setErro(null);
    try {
      const r = await apiParceiro.post(`/parceiro/pedidos/${p.id}/${acao}`, corpo);
      if (r.data.link_manual_cliente) aoFalharAviso(r.data.link_manual_cliente);
      await aoMudar();
    } catch (err) {
      if (montado.current) setErro(err.response?.data?.error || 'Não deu certo. Tente de novo.');
      aoMudar();
    } finally {
      if (montado.current) setAgindo(null);
    }
  }

  const restante = p.responder_ate ? Math.max(0, new Date(p.responder_ate).getTime() - agora) : null;
  const mmss = restante != null ? `${Math.floor(restante / 60000)}:${String(Math.floor((restante % 60000) / 1000)).padStart(2, '0')}` : null;
  const pode = a => (p.acoes || []).includes(a);

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xl sm:text-2xl font-black text-slate-900">#{p.id} · {p.cliente.nome}</p>
        <p className="text-xl sm:text-2xl font-black text-slate-900 whitespace-nowrap">{brl(p.total)}</p>
      </div>
      {p.status === 'enviado' && (
        <p className={`text-lg font-black mt-1 ${p.prazo_esgotado || restante === 0 ? 'text-slate-400' : restante < 120000 ? 'text-red-600' : 'text-amber-700'}`}>
          {p.prazo_esgotado || restante === 0 ? 'Prazo de resposta esgotado' : `Responda em ${mmss}`}
        </p>
      )}
      <ul className="mt-2 text-base sm:text-lg text-slate-800 space-y-0.5">
        {p.itens.map((i, k) => <li key={k}><strong>{i.quantidade}x</strong> {i.nome}</li>)}
      </ul>
      <p className="mt-2 text-base text-slate-600 flex items-center gap-1.5 flex-wrap">
        {p.modo_recebimento === 'retirada' ? <Store className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
        {p.modo_recebimento === 'retirada' ? 'Retirada na loja' : `Entrega · ${p.endereco?.bairro || ''}`}
        {p.aviso_idade && <span className="font-bold text-amber-700">· 18+ conferir documento</span>}
      </p>
      {p.observacao && <p className="mt-1 text-base text-slate-700">📝 {p.observacao}</p>}
      {p.vendedor && <p className="mt-1 text-sm font-semibold text-violet-800">🧑‍💼 Vendedor: {p.vendedor}</p>}
      {erro && <p className="mt-2 text-sm font-semibold text-red-600">{erro}</p>}

      {pode('aceitar') && !recusando && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => agir('aceitar')} disabled={Boolean(agindo)}
            className="py-4 rounded-xl text-lg font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {agindo === 'aceitar' ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />} Aceitar
          </button>
          <button type="button" onClick={() => setRecusando(true)} disabled={Boolean(agindo)}
            className="py-4 rounded-xl text-lg font-black text-red-700 border-2 border-red-300 bg-white flex items-center justify-center gap-2">
            <XCircle className="w-6 h-6" /> Recusar
          </button>
        </div>
      )}
      {recusando && (
        <div className="mt-3 space-y-2">
          <input value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={200} placeholder="Motivo (opcional), ex.: acabou o produto"
            aria-label="Motivo da recusa" className="w-full border border-slate-300 rounded-xl px-3 py-3 text-base" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => agir('recusar', { resposta: motivo || undefined })} disabled={Boolean(agindo)}
              className="py-3 rounded-xl text-base font-black text-white bg-red-600 disabled:opacity-60">
              {agindo === 'recusar' ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Recusar pedido'}
            </button>
            <button type="button" onClick={() => { setRecusando(false); setMotivo(''); }} className="py-3 rounded-xl text-base font-bold text-slate-600 border border-slate-300 bg-white">
              Voltar
            </button>
          </div>
        </div>
      )}
      {pode('pago_saiu') && (
        <button type="button" onClick={() => agir('pago_saiu')} disabled={Boolean(agindo)}
          className="mt-3 w-full py-4 rounded-xl text-lg font-black text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60">
          {agindo === 'pago_saiu' ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (p.modo_recebimento === 'retirada' ? 'Pago, pode retirar' : 'Pago, saiu para entrega')}
        </button>
      )}
    </article>
  );
}
