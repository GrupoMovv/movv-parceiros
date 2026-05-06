import { useEffect, useState } from 'react';
import api from '../../services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users, ClipboardList, DollarSign, TrendingUp,
  CheckCircle2, Clock, AlertCircle, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid
} from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentReferrals, setRecentReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expiring, setExpiring] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [partners, referrals, commissions, pending] = await Promise.all([
        api.get('/partners'),
        api.get('/referrals'),
        api.get('/commissions'),
        api.get('/payments/pending'),
      ]);

      const totalPartners    = partners.data.length;
      const totalReferrals   = referrals.data.length;
      const converted        = referrals.data.filter(r => r.status === 'converted').length;
      const pendingComm      = commissions.data.filter(c => c.status === 'pending').reduce((a, b) => a + parseFloat(b.amount), 0);
      const approvedComm     = commissions.data.filter(c => c.status === 'approved').reduce((a, b) => a + parseFloat(b.amount), 0);
      const totalPayable     = pending.data.reduce((a, b) => a + parseFloat(b.pending_total), 0);

      const byMonth = referrals.data.reduce((acc, r) => {
        const m = r.created_at.slice(0, 7);
        if (!acc[m]) acc[m] = { month: m, total: 0, converted: 0 };
        acc[m].total++;
        if (r.status === 'converted') acc[m].converted++;
        return acc;
      }, {});
      const chartData = Object.values(byMonth)
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-6)
        .map(d => ({ ...d, month: format(new Date(d.month + '-02'), 'MMM/yy', { locale: ptBR }) }));

      setStats({ totalPartners, totalReferrals, converted, pendingComm, approvedComm, totalPayable, chartData });
      setRecentReferrals(referrals.data.slice(0, 8));
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function handleExpire() {
    setExpiring(true);
    try {
      const r = await api.post('/referrals/expire');
      toast.success(`${r.data.expired} indicações expiradas`);
      loadData();
    } catch { toast.error('Erro ao expirar indicações'); }
    finally { setExpiring(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Painel Admin</h1>
          <p className="text-movv-400 text-sm mt-1">Visão geral do Movv Parceiros</p>
        </div>
        <button onClick={handleExpire} disabled={expiring} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className={`w-4 h-4 ${expiring ? 'animate-spin' : ''}`} />
          Expirar pendentes
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Users />}          label="Parceiros"        value={stats.totalPartners}  sub="ativos" />
        <KpiCard icon={<ClipboardList />}  label="Indicações"       value={stats.totalReferrals} sub={`${stats.converted} convertidas`} />
        <KpiCard icon={<Clock />}          label="Comiss. Pendente" value={`R$ ${stats.pendingComm.toLocaleString('pt-BR',{minimumFractionDigits:2})}`} sub="aguardando aprovação" accent />
        <KpiCard icon={<DollarSign />}     label="A Pagar (PIX)"   value={`R$ ${stats.totalPayable.toLocaleString('pt-BR',{minimumFractionDigits:2})}`} sub="comissões aprovadas" accent />
      </div>

      {/* Chart */}
      <div className="card">
        <h3 className="font-semibold text-white mb-5 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gold-400" /> Indicações por Mês
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d1054" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#9D8FBE', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9D8FBE', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#1a0b2e', border: '1px solid #3d1870', borderRadius: 12, color: '#f0e8ff' }}
              cursor={{ fill: 'rgba(107,33,168,0.1)' }}
            />
            <Bar dataKey="total"     name="Total"      fill="#6b21a8" radius={[4,4,0,0]} />
            <Bar dataKey="converted" name="Convertidas" fill="#d4af37" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent referrals */}
      <div className="card">
        <h3 className="font-semibold text-white mb-4">Indicações Recentes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-movv-700">
                {['Protocolo','Cliente','Produto','Parceiro','Status','Data'].map(h => (
                  <th key={h} className="text-left text-movv-400 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentReferrals.map(r => (
                <tr key={r.id} className="border-b border-movv-700/40 hover:bg-movv-800/40 transition-colors">
                  <td className="py-2.5 pr-4 font-mono text-xs text-gold-400">{r.protocol}</td>
                  <td className="py-2.5 pr-4 text-white">{r.client_name}</td>
                  <td className="py-2.5 pr-4 text-movv-300">{r.product_name}</td>
                  <td className="py-2.5 pr-4 text-movv-400 text-xs">{r.partner_code}</td>
                  <td className="py-2.5 pr-4"><StatusBadge status={r.status} /></td>
                  <td className="py-2.5 text-movv-500 text-xs whitespace-nowrap">
                    {format(new Date(r.created_at), 'dd/MM/yy')}
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

function KpiCard({ icon, label, value, sub, accent }) {
  return (
    <div className={accent ? 'card-gold' : 'card'}>
      <div className={`inline-flex p-2 rounded-lg mb-3 ${accent ? 'bg-gold-900/40 text-gold-400' : 'bg-movv-700 text-movv-300'}`}>
        {React.cloneElement(icon, { className: 'w-4 h-4' })}
      </div>
      <p className="text-movv-400 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent ? 'text-gradient' : 'text-white'}`}>{value}</p>
      <p className="text-movv-500 text-xs mt-0.5">{sub}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending:   { cls: 'badge-pending',   label: 'Pendente' },
    converted: { cls: 'badge-converted', label: 'Convertida' },
    expired:   { cls: 'badge-expired',   label: 'Expirada' },
    cancelled: { cls: 'badge-expired',   label: 'Cancelada' },
  };
  const s = map[status] || { cls: 'badge-pending', label: status };
  return <span className={s.cls}>{s.label}</span>;
}

import React from 'react';
