import { useEffect, useState, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  CreditCard, Loader2, CheckSquare, Square, RefreshCw, Clock, AlertTriangle, HelpCircle,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const CATEGORIAS = ['Empregado', 'Empregador patronal', 'Profissional liberal', 'Autonomo', 'Outros'];
const LIMIT = 100;
const AUTO_REFRESH_MS = 60000;

const ABAS = [
  { value: 'vencendo', label: 'Vencendo em breve', icon: Clock, statsKey: 'carteirinha_vencendo' },
  { value: 'vencida', label: 'Vencidas', icon: AlertTriangle, statsKey: 'carteirinha_vencida' },
  { value: 'nao_gerada', label: 'Não geradas', icon: HelpCircle, statsKey: 'carteirinha_nao_gerada' },
];

const CARDS_DASHBOARD = [
  { chave: 'emitidas',    label: 'Emitidas',              icone: '🎫', cls: 'bg-blue-50 border-blue-100 text-blue-900' },
  { chave: 'ativas',      label: 'Ativas',                icone: '✅', cls: 'bg-emerald-50 border-emerald-100 text-emerald-900' },
  { chave: 'vencendo_15', label: 'Vencendo em 15 dias',   icone: '⏰', cls: 'bg-amber-50 border-amber-100 text-amber-900' },
  { chave: 'vencidas',    label: 'Vencidas',              icone: '❌', cls: 'bg-red-50 border-red-100 text-red-900' },
  { chave: 'nao_geradas', label: 'Não Geradas',           icone: '⚪', cls: 'bg-slate-50 border-slate-200 text-slate-700' },
];

function fmtData(iso) {
  if (!iso) return '—';
  return iso.slice(0, 10).split('-').reverse().join('/');
}

const CATEGORIA_LABEL_CURTO = {
  'Empregado': 'Empregado',
  'Empregador patronal': 'Empregador patronal',
  'Profissional liberal': 'Profissional liberal',
  'Autonomo': 'Autônomo',
  'Outros': 'Outros',
};

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

  const [dashboard, setDashboard] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

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

  const loadDashboard = useCallback(async ({ silencioso } = {}) => {
    if (!silencioso) setLoadingDashboard(true);
    try {
      const res = await api.get('/sindicato-carteirinha/stats');
      setDashboard(res.data);
    } catch { if (!silencioso) toast.error('Erro ao carregar dashboard'); }
    finally { setLoadingDashboard(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    loadDashboard();
    const t = setInterval(() => loadDashboard({ silencioso: true }), AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [loadDashboard]);

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
      load(); loadStats(); loadDashboard();
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

      {/* Dashboard */}
      {loadingDashboard ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : dashboard && (
        <div className="space-y-6">
          {/* Cards principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CARDS_DASHBOARD.map(c => (
              <div key={c.chave} className={`rounded-2xl border p-5 transition-all hover:shadow-md hover:-translate-y-0.5 ${c.cls}`}>
                <span className="text-2xl">{c.icone}</span>
                <p className="text-4xl font-bold mt-2">{dashboard[c.chave]}</p>
                <p className="text-xs font-semibold mt-1 opacity-80">{c.label}</p>
              </div>
            ))}
            <div className="rounded-2xl border p-5 transition-all hover:shadow-md hover:-translate-y-0.5 bg-purple-50 border-purple-100 text-purple-900">
              <span className="text-2xl">📊</span>
              <p className="text-4xl font-bold mt-2">{dashboard.cobertura_pct}%</p>
              <p className="text-xs font-semibold mt-1 opacity-80">Cobertura</p>
            </div>
          </div>

          {/* Emissões por mês + Top categorias */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card lg:col-span-2">
              <h3 className="font-semibold text-slate-900 mb-4 text-sm">Emissões por mês (últimos 6 meses)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dashboard.emissoes_por_mes} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 12, color: '#1E293B' }}
                    cursor={{ fill: 'rgba(12,45,72,0.05)' }}
                  />
                  <Bar dataKey="total" name="Emitidas" fill="#0C2D48" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="font-semibold text-slate-900 mb-4 text-sm">Top categorias com carteirinha</h3>
              {dashboard.top_categorias.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma carteirinha emitida ainda.</p>
              ) : (
                <ul className="space-y-3">
                  {dashboard.top_categorias.map(c => (
                    <li key={c.categoria}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 font-medium">{CATEGORIA_LABEL_CURTO[c.categoria] || c.categoria}</span>
                        <span className="text-slate-500">{c.total} ({c.percentual}%)</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-[#0C2D48] rounded-full" style={{ width: `${c.percentual}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Dependentes */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 text-sm">Dependentes</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="card">
                <p className="text-2xl font-bold text-slate-900">{dashboard.dependentes.total}</p>
                <p className="text-xs text-slate-500 mt-1">Total cadastrados</p>
              </div>
              <div className="card">
                <p className="text-2xl font-bold text-emerald-600">{dashboard.dependentes.com_carteirinha}</p>
                <p className="text-xs text-slate-500 mt-1">Com carteirinha</p>
              </div>
              <div className="card">
                <p className="text-2xl font-bold text-slate-400">{dashboard.dependentes.sem_carteirinha}</p>
                <p className="text-xs text-slate-500 mt-1">Sem carteirinha</p>
              </div>
              <div className="card">
                <p className="text-2xl font-bold text-purple-600">{dashboard.dependentes.cobertura_pct}%</p>
                <p className="text-xs text-slate-500 mt-1">Cobertura</p>
              </div>
            </div>
          </div>
        </div>
      )}

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
