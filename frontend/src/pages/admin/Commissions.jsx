import { useEffect, useState, useMemo } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Coins, Search, Filter, CheckCircle2, XCircle, RotateCcw, Clock, Ban } from 'lucide-react';

const STATUS_MAP = {
  pending:   { label: 'Pendente',   cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
  approved:  { label: 'Aprovada',   cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
  paid:      { label: 'Paga',       cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  cancelled: { label: 'Cancelada',  cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
};

const TYPE_MAP = {
  employee:         'Funcionário (51%)',
  accounting:       'Contabilidade (49%)',
  accounting_full:  'Contabilidade (100%)',
  bpo_first:        'BPO 1º Mês',
  bpo_recurring:    'BPO Recorrente',
};

const fmt = v => parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const currentMonth = new Date().toISOString().slice(0, 7);

export default function AdminCommissions() {
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]           = useState('');
  const [acting, setActing]           = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await api.get('/commissions');
      setCommissions(res.data);
    } catch { toast.error('Erro ao carregar comissões'); }
    finally { setLoading(false); }
  }

  async function act(id, action) {
    setActing(id + action);
    try {
      await api.patch(`/commissions/${id}/${action}`);
      const msgs = { approve: 'Comissão aprovada!', cancel: 'Comissão cancelada.', revert: 'Revertida para pendente.' };
      toast.success(msgs[action]);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao processar');
    } finally { setActing(null); }
  }

  const filtered = useMemo(() => {
    let data = commissions;
    if (statusFilter) data = data.filter(c => c.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(c =>
        c.protocol?.toLowerCase().includes(q) ||
        c.client_name?.toLowerCase().includes(q) ||
        c.partner_name?.toLowerCase().includes(q) ||
        c.partner_code?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [commissions, statusFilter, search]);

  const totals = useMemo(() => ({
    pending:   { count: 0, amount: 0 },
    approved:  { count: 0, amount: 0 },
    paidMonth: { count: 0, amount: 0 },
    cancelled: { count: 0 },
  }), []);

  const summary = useMemo(() => {
    const s = { pending: { count: 0, amount: 0 }, approved: { count: 0, amount: 0 }, paidMonth: { count: 0, amount: 0 }, cancelled: { count: 0 } };
    for (const c of commissions) {
      const amt = parseFloat(c.amount);
      if (c.status === 'pending')   { s.pending.count++;  s.pending.amount  += amt; }
      if (c.status === 'approved')  { s.approved.count++; s.approved.amount += amt; }
      if (c.status === 'paid' && c.reference_month === currentMonth) { s.paidMonth.count++; s.paidMonth.amount += amt; }
      if (c.status === 'cancelled') { s.cancelled.count++; }
    }
    return s;
  }, [commissions]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Comissões</h1>
        <p className="text-slate-500 text-sm mt-1">Gerencie todas as comissões geradas pelas indicações convertidas</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          label="Pendentes"
          count={summary.pending.count}
          amount={summary.pending.amount}
          bg="bg-amber-50"
          border="border-amber-200"
          amountColor="text-amber-700"
        />
        <SummaryCard
          icon={<CheckCircle2 className="w-5 h-5 text-blue-500" />}
          label="Aprovadas"
          count={summary.approved.count}
          amount={summary.approved.amount}
          bg="bg-blue-50"
          border="border-blue-200"
          amountColor="text-blue-700"
        />
        <SummaryCard
          icon={<Coins className="w-5 h-5 text-[#1B5E20]" />}
          label="Pagas (mês atual)"
          count={summary.paidMonth.count}
          amount={summary.paidMonth.amount}
          bg="bg-emerald-50"
          border="border-emerald-200"
          amountColor="text-[#1B5E20]"
        />
        <div className={`rounded-2xl p-4 border bg-slate-50 border-slate-200 flex flex-col gap-1`}>
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-slate-400" />
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Canceladas</p>
          </div>
          <p className="text-slate-900 font-bold text-2xl">{summary.cancelled.count}</p>
          <p className="text-slate-400 text-xs">no total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar protocolo, cliente ou parceiro..."
              className="input pl-10"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input pl-9 appearance-none w-48"
            >
              <option value="">Todos os status</option>
              <option value="pending">Pendente</option>
              <option value="approved">Aprovada</option>
              <option value="paid">Paga</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Data', 'Protocolo', 'Cliente', 'Produto', 'Parceiro', 'Tipo', 'Valor', 'Status', 'Ações'].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <div className="w-6 h-6 border-2 border-movv-900 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">Nenhuma comissão encontrada</td>
                </tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">
                    {format(new Date(c.created_at), 'dd/MM/yy')}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-[#C9A84C] whitespace-nowrap">{c.protocol}</td>
                  <td className="py-3 px-4 text-slate-900 whitespace-nowrap">{c.client_name}</td>
                  <td className="py-3 px-4 text-slate-600 whitespace-nowrap max-w-[160px] truncate">{c.product_name}</td>
                  <td className="py-3 px-4 text-xs">
                    <p className="text-slate-900">{c.partner_name}</p>
                    <p className="text-[#C9A84C] font-mono">{c.partner_code}</p>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <p className="text-slate-600 whitespace-nowrap">{TYPE_MAP[c.type] || c.type}</p>
                    {c.type === 'accounting' && (
                      <p className="text-slate-400 italic whitespace-nowrap">
                        34% líq. + 15% imp. = 49%
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <p className="text-[#1B5E20] font-bold">R$ {fmt(c.amount)}</p>
                    {c.type === 'accounting' && (
                      <p className="text-slate-400 text-xs">
                        imp. R$ {fmt(parseFloat(c.amount) * (15 / 49))}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_MAP[c.status]?.cls}`}>
                      {STATUS_MAP[c.status]?.label}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <ActionButtons commission={c} acting={acting} act={act} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, count, amount, bg, border, amountColor }) {
  return (
    <div className={`rounded-2xl p-4 border ${bg} ${border} flex flex-col gap-1`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-slate-900 font-bold text-2xl">{count}</p>
      <p className={`text-sm font-semibold ${amountColor}`}>R$ {parseFloat(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
    </div>
  );
}

function ActionButtons({ commission: c, acting, act }) {
  const loading = key => acting === c.id + key;

  if (c.status === 'pending') {
    return (
      <div className="flex items-center gap-1.5">
        <button
          disabled={!!acting}
          onClick={() => act(c.id, 'approve')}
          className="flex items-center gap-1 text-xs text-[#1B5E20] hover:text-emerald-700 border border-emerald-200 hover:border-emerald-300 bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading('approve')
            ? <span className="w-3 h-3 border border-emerald-600 border-t-transparent rounded-full animate-spin" />
            : <CheckCircle2 className="w-3 h-3" />}
          Aprovar
        </button>
        <button
          disabled={!!acting}
          onClick={() => act(c.id, 'cancel')}
          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 bg-red-50 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading('cancel')
            ? <span className="w-3 h-3 border border-red-500 border-t-transparent rounded-full animate-spin" />
            : <XCircle className="w-3 h-3" />}
          Cancelar
        </button>
      </div>
    );
  }

  if (c.status === 'approved') {
    return (
      <button
        disabled={!!acting}
        onClick={() => act(c.id, 'revert')}
        className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 border border-slate-200 hover:border-slate-300 bg-slate-50 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading('revert')
          ? <span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
          : <RotateCcw className="w-3 h-3" />}
        Reverter
      </button>
    );
  }

  return <span className="text-slate-300 text-xs">—</span>;
}
