import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { ClipboardList, RefreshCw } from 'lucide-react';

function StatusBadge({ status }) {
  const map = {
    pending:     'bg-yellow-100 text-yellow-700 border border-yellow-200',
    in_progress: 'bg-blue-100 text-blue-700 border border-blue-200',
    approved:    'bg-green-100 text-green-700 border border-green-200',
    cancelled:   'bg-slate-100 text-slate-500 border border-slate-200',
    expired:     'bg-red-100 text-red-700 border border-red-200',
  };
  const labels = {
    pending: 'Pendente', in_progress: 'Em andamento', approved: 'Aprovado',
    cancelled: 'Cancelado', expired: 'Expirado',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-500'}`}>
      {labels[status] || status}
    </span>
  );
}

const STATUS_FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'pending', label: 'Pendente' },
  { key: 'in_progress', label: 'Em andamento' },
  { key: 'approved', label: 'Aprovado' },
  { key: 'cancelled', label: 'Cancelado' },
  { key: 'expired', label: 'Expirado' },
];

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt) - new Date()) / 86400000));
}

function formatBRL(v) {
  if (!v) return '—';
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function IndicadorMinhasIndicacoes() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [renewing, setRenewing] = useState(null);

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter ? `?status=${filter}` : '';
      const res = await api.get(`/indicators/referrals${params}`);
      setReferrals(res.data);
    } catch {
      toast.error('Erro ao carregar indicações');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

  async function handleRenew(id) {
    setRenewing(id);
    try {
      await api.put(`/indicators/referrals/${id}/renew`);
      toast.success('Indicação renovada por mais 10 dias!');
      fetchReferrals();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao renovar');
    } finally {
      setRenewing(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#0C2D48]/10 rounded-xl flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-[#0C2D48]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Minhas Indicações</h1>
          <p className="text-slate-500 text-sm">Acompanhe o status de todas as suas indicações</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${
              filter === key
                ? 'bg-[#0C2D48] text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-[#0C2D48] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Nenhuma indicação encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">CPF</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Produto</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Comissão est.</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Data</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Dias rest.</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {referrals.map(r => {
                  const dias = daysLeft(r.expires_at);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-800 text-sm">{r.client_name}</td>
                      <td className="px-4 py-3 text-slate-600 text-sm font-mono">{r.client_cpf}</td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{r.product_name || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{formatBRL(r.commission_value)}</td>
                      <td className="px-4 py-3 text-slate-500 text-sm">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3">
                        {dias !== null && r.status === 'pending' ? (
                          <span className={`text-sm font-semibold ${dias <= 2 ? 'text-red-500' : dias <= 5 ? 'text-yellow-500' : 'text-green-600'}`}>
                            {dias}d
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {r.status === 'pending' && (
                          <button
                            onClick={() => handleRenew(r.id)}
                            disabled={renewing === r.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            <RefreshCw className={`w-3 h-3 ${renewing === r.id ? 'animate-spin' : ''}`} />
                            Renovar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
