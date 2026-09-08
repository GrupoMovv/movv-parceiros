import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Flame, Lock, Clock, Check, TrendingUp } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, DOURADO, PRETO } from '../public/Marketplace/theme';

const VERMELHO = '#DC2626';

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function ParceiroFechaMes() {
  const { parceiro } = useOutletContext();
  const [info, setInfo] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [confirmados, setConfirmados] = useState([]);
  const [historico, setHistorico] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [selecionados, setSelecionados] = useState({}); // { [produto_id]: preco_fecha_mes }
  const [enviando, setEnviando] = useState(false);

  const carregar = async () => {
    try {
      const [infoRes, meusRes] = await Promise.all([
        apiParceiro.get('/parceiro/fecha-mes/proximo'),
        apiParceiro.get('/parceiro/fecha-mes/meus'),
      ]);
      setInfo(infoRes.data);
      setConfirmados(meusRes.data.produtos);
      if (infoRes.data.pode_participar) {
        const produtosRes = await apiParceiro.get('/parceiro/produtos', { params: { status: 'ativo' } });
        setProdutos(produtosRes.data.produtos);
      }
    } catch {
      toast.error('Erro ao carregar Fecha Mês');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    apiParceiro.get('/parceiro/fecha-mes/historico').then(res => setHistorico(res.data.historico)).catch(() => setHistorico([]));
  }, []);

  const idsConfirmados = useMemo(() => new Set(confirmados.map(c => c.produto_id)), [confirmados]);
  const produtosDisponiveis = produtos.filter(p => !idsConfirmados.has(p.id));
  const qtdSelecionados = Object.keys(selecionados).length;
  const vagasRestantes = info ? info.limite_produtos - confirmados.length - qtdSelecionados : 0;

  function alternarSelecao(produto) {
    setSelecionados(atual => {
      const novo = { ...atual };
      if (produto.id in novo) { delete novo[produto.id]; return novo; }
      if (vagasRestantes <= 0) { toast.error(`Limite de ${info.limite_produtos} produtos do seu plano atingido`); return atual; }
      novo[produto.id] = '';
      return novo;
    });
  }

  function mudarPreco(produtoId, valor) {
    setSelecionados(atual => ({ ...atual, [produtoId]: valor }));
  }

  async function confirmarParticipacao() {
    const itens = Object.entries(selecionados).map(([produto_id, preco_fecha_mes]) => ({ produto_id: Number(produto_id), preco_fecha_mes }));
    if (itens.some(it => !it.preco_fecha_mes || parseFloat(it.preco_fecha_mes) <= 0)) {
      return toast.error('Preencha o preço especial de todos os produtos selecionados');
    }
    setEnviando(true);
    try {
      const res = await apiParceiro.post('/parceiro/fecha-mes/participar', { produtos: itens });
      if (res.data.rejeitados?.length > 0) {
        res.data.rejeitados.forEach(r => toast.error(`Produto #${r.produto_id}: ${r.motivo}`));
      }
      if (res.data.confirmados?.length > 0) toast.success(`${res.data.confirmados.length} produto(s) confirmado(s) no Fecha Mês!`);
      setSelecionados({});
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao confirmar participação');
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: `${ROXO}33`, borderTopColor: ROXO }} />
      </div>
    );
  }

  if (!info?.pode_participar) return <BannerUpgrade />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: PRETO }}>
          <Flame className="w-5 h-5" style={{ color: VERMELHO }} /> Fecha Mês
        </h1>
        <p className="text-slate-500 text-sm mt-1">A super promoção de 24h do IUB MAIS — benefício exclusivo do seu plano.</p>
      </div>

      <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${ROXO} 0%, #7C3AED 100%)` }}>
        <p className="text-white/70 text-xs font-bold uppercase tracking-wide">Próximo Fecha Mês</p>
        <p className="text-2xl font-extrabold mt-1">{formatarData(info.data_evento)}</p>
        <p className="text-white/80 text-sm mt-1">
          {info.ativo_hoje ? '🔥 Está ativo agora!' : `Faltam ${info.dias_restantes} dia${info.dias_restantes === 1 ? '' : 's'}`}
        </p>
        <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold" style={{ color: info.passou_deadline ? '#FCA5A5' : DOURADO }}>
          <Clock className="w-3.5 h-3.5" />
          {info.passou_deadline
            ? 'Prazo de confirmação encerrado pra essa edição'
            : `Confirme até quinta-feira, ${formatarData(info.deadline_confirmacao.slice(0, 10))} às 23:59`}
        </div>
      </div>

      {!info.passou_deadline && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-sm" style={{ color: PRETO }}>Selecione seus produtos</h2>
            <span className="text-xs font-semibold text-slate-400">{confirmados.length + qtdSelecionados} / {info.limite_produtos} produtos</span>
          </div>
          <p className="text-slate-400 text-xs mb-4">Depois de confirmar, o produto não pode mais ser alterado ou removido dessa edição.</p>

          {confirmados.length > 0 && (
            <div className="space-y-2 mb-4">
              {confirmados.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div className="w-9 h-9 rounded-lg bg-white flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {c.fotos?.[0]?.url && <img src={c.fotos[0].url} alt="" className="w-full h-full object-contain" />}
                  </div>
                  <p className="text-sm font-medium flex-1 truncate" style={{ color: PRETO }}>{c.nome}</p>
                  <p className="text-xs text-slate-400 line-through">{formatarPreco(c.preco_original)}</p>
                  <p className="text-sm font-bold" style={{ color: VERMELHO }}>{formatarPreco(c.preco_fecha_mes)}</p>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">Confirmado</span>
                </div>
              ))}
            </div>
          )}

          {produtosDisponiveis.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-4">
              {produtos.length === 0 ? 'Cadastre produtos ativos pra poder participar.' : 'Todos os seus produtos já foram confirmados ou você atingiu o limite.'}
            </p>
          ) : (
            <div className="space-y-2">
              {produtosDisponiveis.map(p => {
                const marcado = p.id in selecionados;
                return (
                  <div key={p.id} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${marcado ? 'border-purple-200 bg-purple-50' : 'border-slate-100'}`}>
                    <input type="checkbox" checked={marcado} onChange={() => alternarSelecao(p)} className="w-4 h-4 flex-shrink-0" style={{ accentColor: ROXO }} />
                    <div className="w-9 h-9 rounded-lg bg-slate-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {p.fotos?.[0]?.url && <img src={p.fotos[0].url} alt="" className="w-full h-full object-contain" />}
                    </div>
                    <p className="text-sm font-medium flex-1 truncate" style={{ color: PRETO }}>{p.nome}</p>
                    <p className="text-xs text-slate-400 line-through flex-shrink-0">{formatarPreco(p.preco)}</p>
                    {marcado && (
                      <input
                        type="number" step="0.01" placeholder="Preço Fecha Mês"
                        value={selecionados[p.id]} onChange={e => mudarPreco(p.id, e.target.value)}
                        className="w-28 px-2 py-1.5 text-sm border border-slate-200 rounded-lg flex-shrink-0"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {qtdSelecionados > 0 && (
            <button
              type="button" onClick={confirmarParticipacao} disabled={enviando}
              className="mt-4 w-full text-sm font-bold py-2.5 rounded-lg text-white disabled:opacity-60"
              style={{ backgroundColor: ROXO }}
            >
              {enviando ? 'Confirmando...' : `Confirmar participação (${qtdSelecionados} produto${qtdSelecionados === 1 ? '' : 's'})`}
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-bold text-sm mb-4 flex items-center gap-1.5" style={{ color: PRETO }}>
          <TrendingUp className="w-4 h-4" style={{ color: ROXO }} /> Histórico
        </h2>
        {!historico ? (
          <p className="text-slate-400 text-xs">Carregando...</p>
        ) : historico.length === 0 ? (
          <p className="text-slate-400 text-xs text-center py-4">Você ainda não participou de nenhuma edição do Fecha Mês.</p>
        ) : (
          <div className="space-y-2">
            {historico.map(h => (
              <div key={h.data_evento} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 text-sm">
                <span className="font-medium" style={{ color: PRETO }}>{formatarData(h.data_evento)}</span>
                <span className="text-xs text-slate-400">{h.produtos_participantes} produto{h.produtos_participantes === 1 ? '' : 's'}</span>
                <span className="text-xs font-bold" style={{ color: ROXO }}>{h.cliques_no_dia} cliques</span>
                <span className="text-[11px] text-slate-400">vs {h.media_cliques_dia_normal} num dia normal</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BannerUpgrade() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
      <Lock className="w-8 h-8 mx-auto text-slate-300" />
      <h1 className="font-bold text-lg mt-4" style={{ color: PRETO }}>Fecha Mês é exclusivo pra planos pagos</h1>
      <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">
        Todo último sexta do mês, seus produtos entram numa vitrine especial com destaque e comunicação pros associados. Faça upgrade pra participar.
      </p>
      <Link
        to="/parceiro/painel/planos"
        className="inline-flex items-center gap-1.5 mt-5 text-sm font-bold px-5 py-2.5 rounded-xl text-white"
        style={{ backgroundColor: ROXO }}
      >
        Ver planos
      </Link>
    </div>
  );
}
