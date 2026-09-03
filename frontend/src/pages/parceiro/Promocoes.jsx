import { useEffect, useState, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Pause, Play, Copy, Loader2, Eye, MessageCircle } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, DOURADO, PRETO } from '../public/Marketplace/theme';

const CHAVE_DISPENSADAS = 'iub_mais_promos_expiradas_dispensadas';
const TRES_DIAS_MS = 3 * 24 * 60 * 60 * 1000;

function lerDispensadas() {
  try { return new Set(JSON.parse(localStorage.getItem(CHAVE_DISPENSADAS)) || []); }
  catch { return new Set(); }
}

function marcarDispensada(id) {
  const atuais = lerDispensadas();
  atuais.add(id);
  try { localStorage.setItem(CHAVE_DISPENSADAS, JSON.stringify([...atuais])); } catch { /* localStorage indisponível */ }
}

const FILTROS = [
  ['', 'Todas'], ['ativa', 'Ativas'], ['programada', 'Programadas'],
  ['expirada', 'Expiradas'], ['pausada', 'Pausadas'], ['rascunho', 'Rascunhos'],
];

const STATUS_INFO = {
  ativa:      { label: 'Ativa',      dot: '🟢', cls: 'bg-emerald-50 text-emerald-700' },
  programada: { label: 'Programada', dot: '🔵', cls: 'bg-blue-50 text-blue-700' },
  expirada:   { label: 'Expirada',   dot: '🔴', cls: 'bg-red-50 text-red-600' },
  esgotada:   { label: 'Esgotada',   dot: '⚫', cls: 'bg-slate-200 text-slate-600' },
  pausada:    { label: 'Pausada',    dot: '⏸️', cls: 'bg-slate-100 text-slate-500' },
  rascunho:   { label: 'Rascunho',   dot: '📝', cls: 'bg-slate-100 text-slate-500' },
};

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function diffTexto(ms) {
  const abs = Math.abs(ms);
  const horas = abs / 3.6e6;
  if (horas < 1) return `${Math.max(1, Math.round(abs / 60000))} min`;
  if (horas < 24) return `${Math.round(horas)}h`;
  return `${Math.round(horas / 24)} dias`;
}

function prazoTexto(promo) {
  const agora = Date.now();
  const inicio = new Date(promo.data_inicio).getTime();
  const fim = new Date(promo.data_fim).getTime();
  if (promo.status_calculado === 'programada') return `Começa em ${diffTexto(inicio - agora)}`;
  if (promo.status_calculado === 'ativa') return `Termina em ${diffTexto(fim - agora)}`;
  if (promo.status_calculado === 'expirada' || promo.status_calculado === 'esgotada') return `Encerrada há ${diffTexto(agora - fim)}`;
  return null;
}

export default function ParceiroPromocoes() {
  const { parceiro } = useOutletContext();
  const [promocoes, setPromocoes] = useState(null);
  const [ativas, setAtivas] = useState(0);
  const [limite, setLimite] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [processandoId, setProcessandoId] = useState(null);

  const carregar = useCallback(() => {
    const params = {};
    if (filtro) params.status = filtro;
    apiParceiro.get('/parceiro/promocoes', { params })
      .then(res => { setPromocoes(res.data.promocoes); setAtivas(res.data.ativas); setLimite(res.data.limite); })
      .catch(() => toast.error('Erro ao carregar promoções'));
  }, [filtro]);

  useEffect(() => { carregar(); }, [carregar]);

  // Notificação leve de "sua promo expirou, quer duplicar?" — roda uma vez
  // ao entrar na página (independente do filtro ativo), ignora quem já foi
  // dispensado antes (guardado no localStorage deste navegador).
  useEffect(() => {
    apiParceiro.get('/parceiro/promocoes', { params: { status: 'expirada' } }).then(res => {
      const dispensadas = lerDispensadas();
      const agora = Date.now();
      const recentes = res.data.promocoes.filter(p => {
        if (dispensadas.has(p.id)) return false;
        const fim = new Date(p.data_fim).getTime();
        return agora - fim < TRES_DIAS_MS;
      });
      recentes.slice(0, 3).forEach(p => {
        toast((t) => (
          <div className="flex flex-col gap-2 text-sm">
            <p>Sua promoção <strong>"{p.titulo}"</strong> expirou. Deseja duplicar?</p>
            <div className="flex gap-2">
              <button
                onClick={async () => { toast.dismiss(t.id); marcarDispensada(p.id); await handleDuplicar(p); }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: ROXO }}
              >
                Duplicar
              </button>
              <button
                onClick={() => { toast.dismiss(t.id); marcarDispensada(p.id); }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200"
              >
                Dispensar
              </button>
            </div>
          </div>
        ), { duration: 15000, id: `promo-expirada-${p.id}` });
      });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggle(promo) {
    setProcessandoId(promo.id);
    try {
      await apiParceiro.post(`/parceiro/promocoes/${promo.id}/toggle`);
      toast.success(promo.ativo ? 'Promoção pausada' : 'Promoção ativada');
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao alterar status');
    } finally {
      setProcessandoId(null);
    }
  }

  async function handleDuplicar(promo) {
    setProcessandoId(promo.id);
    try {
      await apiParceiro.post(`/parceiro/promocoes/${promo.id}/duplicar`);
      toast.success('Promoção duplicada como rascunho!');
      carregar();
    } catch {
      toast.error('Erro ao duplicar promoção');
    } finally {
      setProcessandoId(null);
    }
  }

  async function handleExcluir(promo) {
    if (!window.confirm(`Excluir "${promo.titulo}"? Essa ação não pode ser desfeita.`)) return;
    setProcessandoId(promo.id);
    try {
      await apiParceiro.delete(`/parceiro/promocoes/${promo.id}`);
      toast.success('Promoção excluída');
      carregar();
    } catch {
      toast.error('Erro ao excluir promoção');
    } finally {
      setProcessandoId(null);
    }
  }

  const limiteAtingido = limite !== null && ativas >= limite;
  const limiteQuaseAtingido = !limiteAtingido && limite !== null && ativas >= limite * 0.8;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: PRETO }}>Promoções</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {limite === null ? `${ativas} promoções ativas` : `${ativas} de ${limite} promoções ativas`}
            {parceiro?.plano && <span className="capitalize"> · plano {parceiro.plano}</span>}
          </p>
        </div>
        <Link
          to="/parceiro/painel/promocoes/novo"
          className="flex items-center gap-2 text-white font-semibold text-sm px-5 py-3 rounded-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg"
          style={{ backgroundColor: ROXO }}
        >
          <Plus className="w-4 h-4" /> Nova Promoção
        </Link>
      </div>

      {limiteAtingido && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          Você atingiu o limite de <strong>{limite} promoções ativas</strong> do seu plano. Pause uma promoção existente pra publicar outra, ou fale com o Sindicato sobre upgrade de plano.
        </div>
      )}
      {limiteQuaseAtingido && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-700">
          🔥 Suas vagas de promoção estão acabando! Você já usou {ativas} de {limite} do seu plano.
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {FILTROS.map(([v, l]) => (
          <button
            key={v} onClick={() => setFiltro(v)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={filtro === v ? { backgroundColor: ROXO, color: 'white' } : { backgroundColor: '#F1F5F9', color: '#475569' }}
          >
            {l}
          </button>
        ))}
      </div>

      {promocoes === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>
      ) : promocoes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <p className="text-slate-500 text-sm">Nenhuma promoção encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {promocoes.map(p => {
            const desconto = Math.round(((p.preco_de - p.preco_por) / p.preco_de) * 100);
            const info = STATUS_INFO[p.status_calculado];
            const taxaConversao = p.visualizacoes > 0 ? Math.round((p.cliques_whatsapp / p.visualizacoes) * 100) : null;

            return (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="relative aspect-[4/3] bg-slate-50 flex items-center justify-center">
                  {p.foto_resolvida ? (
                    <img src={p.foto_resolvida} alt={p.titulo} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-slate-300 text-xs">Sem foto</span>
                  )}
                  <span className="absolute top-2 left-2 text-[10px] font-black px-2 py-1 rounded-full" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>
                    {desconto}% OFF
                  </span>
                  <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-full ${info.cls}`}>
                    {info.dot} {info.label}
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-sm truncate" style={{ color: PRETO }}>{p.titulo}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400 line-through">{formatarPreco(p.preco_de)}</span>
                    <span className="font-bold text-sm" style={{ color: ROXO }}>{formatarPreco(p.preco_por)}</span>
                  </div>

                  <p className="text-slate-400 text-xs mt-1.5">{prazoTexto(p)}</p>
                  {p.limite_usos && (
                    <p className="text-slate-400 text-xs mt-0.5">{p.usos_atuais}/{p.limite_usos} usados</p>
                  )}

                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-50 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {p.visualizacoes}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {p.cliques_whatsapp}</span>
                    {taxaConversao !== null && <span>· {taxaConversao}% conversão</span>}
                  </div>

                  <div className="flex items-center gap-1.5 mt-auto pt-3">
                    <Link to={`/parceiro/painel/promocoes/${p.id}`} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </Link>
                    <button type="button" onClick={() => handleToggle(p)} disabled={processandoId === p.id} title={p.ativo ? 'Pausar' : 'Ativar'}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50">
                      {p.ativo ? <Pause className="w-3.5 h-3.5 text-slate-500" /> : <Play className="w-3.5 h-3.5 text-slate-500" />}
                    </button>
                    <button type="button" onClick={() => handleDuplicar(p)} disabled={processandoId === p.id} title="Duplicar"
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50">
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <button type="button" onClick={() => handleExcluir(p)} disabled={processandoId === p.id} title="Excluir"
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-red-50 transition-colors disabled:opacity-50">
                      {processandoId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-red-500" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
