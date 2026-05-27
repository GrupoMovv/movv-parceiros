import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { UserPlus, Clock, DollarSign, CheckCircle, TrendingUp } from 'lucide-react';

function formatBRL(v) {
  return parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function StatusBadge({ status }) {
  const map = {
    pending:     'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    approved:    'bg-green-100 text-green-700',
    cancelled:   'bg-slate-100 text-slate-500',
    expired:     'bg-red-100 text-red-700',
  };
  const labels = {
    pending: 'Pendente', in_progress: 'Em andamento', approved: 'Aprovado',
    cancelled: 'Cancelado', expired: 'Expirado',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-500'}`}>
      {labels[status] || status}
    </span>
  );
}

export default function IndicadorDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/indicators/dashboard')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = data ? [
    { label: 'Indicações ativas', value: data.active_count, icon: Clock, color: 'bg-blue-500/10 text-blue-600' },
    { label: 'Aprovadas', value: data.approved_count, icon: CheckCircle, color: 'bg-green-500/10 text-green-600' },
    { label: 'Comissão pendente', value: formatBRL(data.commission_pending), icon: DollarSign, color: 'bg-yellow-500/10 text-yellow-600' },
    { label: 'Total recebido', value: formatBRL(data.commission_received), icon: TrendingUp, color: 'bg-blue-500/10 text-blue-700' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Olá, {user?.name?.split(' ')[0]}!</h1>
        <p className="text-slate-500 text-sm mt-1">Bem-vindo ao seu painel de indicações</p>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
              <div className="h-8 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm text-slate-500 font-medium">{label}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Últimas Indicações</h2>
        <Link
          to="/indicador/indicar"
          className="inline-flex items-center gap-2 bg-[#0C2D48] hover:bg-[#5a1eaf] text-white font-semibold text-sm px-4 py-2 rounded-xl transition-all"
        >
          <UserPlus className="w-4 h-4" /> Nova Indicação
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-2 border-[#0C2D48] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data?.recent_referrals?.length ? (
          <div className="text-center py-12 text-slate-500">
            <UserPlus className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Nenhuma indicação ainda</p>
            <Link to="/indicador/indicar" className="text-[#0C2D48] text-sm underline mt-2 inline-block">Fazer primeira indicação</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Produto</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent_referrals.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800 text-sm">{r.client_name}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{r.product_name || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-slate-500 text-sm">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
