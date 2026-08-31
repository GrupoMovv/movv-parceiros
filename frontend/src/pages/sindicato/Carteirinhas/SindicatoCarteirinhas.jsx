import { useEffect, useState, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  CreditCard, Loader2, CheckSquare, Square, RefreshCw, Clock, AlertTriangle, HelpCircle,
} from 'lucide-react';

const CATEGORIAS = ['Empregado', 'Empregador patronal', 'Profissional liberal', 'Autonomo', 'Outros'];
const LIMIT = 100;

const ABAS = [
  { value: 'vencendo', label: 'Vencendo em breve', icon: Clock, statsKey: 'carteirinha_vencendo' },
  { value: 'vencida', label: 'Vencidas', icon: AlertTriangle, statsKey: 'carteirinha_vencida' },
  { value: 'nao_gerada', label: 'Não geradas', icon: HelpCircle, statsKey: 'carteirinha_nao_gerada' },
];

function fmtData(iso) {
  if (!iso) return '—';
  return iso.slice(0, 10).split('-').reverse().join('/');
}

export default function SindicatoCarteirinhas() {
  const [aba, setAba] = useState('vencendo');
  const [categoria, setCategoria] = useState('');
  const [empresaId, setEmpresaId] = useState(null);
  const [empresaLabel, setEmpresaLabel] = useState('');
  const [empresaBusca, setEmpresaBusca] = useState('');
  const [empresaOpcoes, setEmpresaOpcoes] = useState([]);

  const [associados, setAssociados] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [selecionados, setSelecionados] = useState(new Set());
  const [gerandoMassa, setGerandoMassa] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/sindicato-associados', {
        params: {
          page: 1, limit: LIMIT, status: 'ativo',
          carteirinha: aba, categoria: categoria || undefined, empresa_id: empresaId || undefined,
        },
      });
      setAssociados(res.data.data);
      setTotal(res.data.total);
      setSelecionados(new Set());
    } catch { toast.error('Erro ao carregar associados'); }
    finally { setLoading(false); }
  }, [aba, categoria, empresaId]);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/sindicato-associados/stats');
      setStats(res.data);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!empresaBusca.trim()) { setEmpresaOpcoes([]); return; }
      try {
        const res = await api.get('/sindicato-empresas/empresas', { params: { search: empresaBusca } });
        setEmpresaOpcoes(res.data);
      } catch { /* silencioso */ }
    }, 300);
    return () => clearTimeout(t);
  }, [empresaBusca]);

  function toggleSelecionado(id) {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    setSelecionados(prev => prev.size === associados.length ? new Set() : new Set(associados.map(a => a.id)));
  }

  async function gerarEmMassa() {
    if (selecionados.size === 0) return;
    setGerandoMassa(true);
    try {
      const res = await api.post('/sindicato-carteirinha/gerar-massa', { associado_ids: [...selecionados] });
      toast.success(`${res.data.gerados.length} carteirinha(s) gerada(s)!`);
      if (res.data.erros?.length) toast.error(`${res.data.erros.length} não puderam ser geradas`);
      load(); loadStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar carteirinhas em massa');
    } finally { setGerandoMassa(false); }
  }

  const abaAtual = ABAS.find(a => a.value === aba);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-[#0C2D48]" />
          Carteirinhas
        </h1>
        <p className="text-slate-500 text-sm mt-1">Acompanhe validade e gere carteirinhas digitais em massa.</p>
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b border-slate-200">
        {ABAS.map(a => (
          <button
            key={a.value}
            onClick={() => setAba(a.value)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              aba === a.value ? 'border-[#0C2D48] text-[#0C2D48]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <a.icon className="w-4 h-4" />
            {a.label}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${aba === a.value ? 'bg-[#0C2D48] text-white' : 'bg-slate-100 text-slate-500'}`}>
              {stats?.[a.statsKey] ?? '—'}
            </span>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <select className="input w-auto" value={categoria} onChange={e => setCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="relative w-64">
          {empresaId ? (
            <div className="flex items-center justify-between input">
              <span className="text-slate-700 text-sm truncate">{empresaLabel}</span>
              <button onClick={() => { setEmpresaId(null); setEmpresaLabel(''); }} className="text-xs text-red-500 hover:text-red-700 flex-shrink-0 ml-2">remover</button>
            </div>
          ) : (
            <input className="input" placeholder="Filtrar por empresa..." value={empresaBusca} onChange={e => setEmpresaBusca(e.target.value)} />
          )}
          {!empresaId && empresaOpcoes.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100">
              {empresaOpcoes.map(e => (
                <button
                  key={e.id}
                  onClick={() => { setEmpresaId(e.id); setEmpresaLabel(e.nome_fantasia || e.razao_social); setEmpresaBusca(''); setEmpresaOpcoes([]); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                >
                  {e.nome_fantasia || e.razao_social}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <button
          onClick={gerarEmMassa}
          disabled={selecionados.size === 0 || gerandoMassa}
          className="flex items-center gap-2 whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50"
        >
          {gerandoMassa ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Gerar em Massa ({selecionados.size})
        </button>
      </div>

      {/* Tabela */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="py-3 px-4 w-10">
                  <button onClick={toggleTodos} title="Selecionar todos">
                    {selecionados.size === associados.length && associados.length > 0 ? <CheckSquare className="w-4 h-4 text-[#0C2D48]" /> : <Square className="w-4 h-4 text-slate-300" />}
                  </button>
                </th>
                {['Nome', 'Categoria', 'Empresa', 'Validade'].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              ) : associados.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">
                  {abaAtual && <>Nenhum associado em &quot;{abaAtual.label}&quot; para esses filtros</>}
                </td></tr>
              ) : associados.map(a => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <button onClick={() => toggleSelecionado(a.id)}>
                      {selecionados.has(a.id) ? <CheckSquare className="w-4 h-4 text-[#0C2D48]" /> : <Square className="w-4 h-4 text-slate-300" />}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-slate-900 font-medium">{a.nome_completo}</td>
                  <td className="py-3 px-4 text-slate-600">{a.categoria_profissional || '—'}</td>
                  <td className="py-3 px-4 text-slate-600">{a.empresa_nome || a.empresa_nome_livre || '—'}</td>
                  <td className="py-3 px-4 text-slate-600">{fmtData(a.carteirinha_valida_ate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            {total} associado(s) {total > LIMIT ? `— mostrando os primeiros ${LIMIT}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
