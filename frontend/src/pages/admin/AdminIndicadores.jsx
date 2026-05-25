import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Users, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';

const TABS = [
  { key: 'pending',   label: 'Pendentes',  icon: Clock,         color: 'text-yellow-400' },
  { key: 'approved',  label: 'Aprovados',  icon: CheckCircle,   color: 'text-green-400'  },
  { key: 'rejected',  label: 'Rejeitados', icon: XCircle,       color: 'text-red-400'    },
  { key: 'suspended', label: 'Suspensos',  icon: AlertCircle,   color: 'text-orange-400' },
];

function Badge({ status }) {
  const map = {
    pending:   'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    approved:  'bg-green-500/20 text-green-300 border-green-500/30',
    rejected:  'bg-red-500/20 text-red-300 border-red-500/30',
    suspended: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  };
  const labels = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado', suspended: 'Suspenso' };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${map[status] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
      {labels[status] || status}
    </span>
  );
}

function RejectModal({ indicator, onClose, onReject }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReject() {
    setLoading(true);
    await onReject(indicator.id, reason);
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-white font-bold text-lg mb-1">Rejeitar Indicador</h3>
        <p className="text-white/60 text-sm mb-4">{indicator.name}</p>
        <label className="block text-xs text-white/60 font-semibold uppercase tracking-wider mb-1.5">Motivo da rejeição</label>
        <textarea
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Descreva o motivo..."
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-red-500 resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/70 hover:text-white transition-colors text-sm font-semibold">
            Cancelar
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm transition-colors"
          >
            {loading ? 'Rejeitando...' : 'Rejeitar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminIndicadores() {
  const [activeTab, setActiveTab] = useState('pending');
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({});
  const [rejectTarget, setRejectTarget] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await api.get('/indicators');
      const all = res.data;
      const c = {};
      TABS.forEach(t => { c[t.key] = all.filter(i => i.status === t.key).length; });
      setCounts(c);
    } catch {}
  }, []);

  const fetchTab = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/indicators?status=${activeTab}`);
      setIndicators(res.data);
    } catch {
      toast.error('Erro ao carregar indicadores');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchTab(); }, [fetchTab]);

  async function handleApprove(id) {
    try {
      await api.put(`/indicators/${id}/approve`);
      toast.success('Indicador aprovado!');
      fetchTab();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao aprovar');
    }
  }

  async function handleReject(id, reason) {
    try {
      await api.put(`/indicators/${id}/reject`, { rejection_reason: reason });
      toast.success('Indicador rejeitado');
      fetchTab();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao rejeitar');
    }
  }

  async function handleSuspend(id) {
    if (!confirm('Suspender este indicador?')) return;
    try {
      await api.put(`/indicators/${id}/suspend`);
      toast.success('Indicador suspenso');
      fetchTab();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao suspender');
    }
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('pt-BR');
  }

  return (
    <div className="space-y-6">
      {rejectTarget && (
        <RejectModal
          indicator={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onReject={handleReject}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#4A0E8F]/20 rounded-xl flex items-center justify-center">
          <Users className="w-5 h-5 text-[#4A0E8F]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Programa Indique Azul e Ganhe</h1>
          <p className="text-slate-500 text-sm">Gerencie os indicadores do programa</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-[#4A0E8F] text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Icon className={`w-4 h-4 ${activeTab === key ? 'text-white' : color}`} />
            {label}
            {counts[key] > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold leading-none ${
                activeTab === key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#4A0E8F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : indicators.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Nenhum indicador {TABS.find(t => t.key === activeTab)?.label.toLowerCase() || ''}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Nome</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">CPF</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">WhatsApp</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">E-mail</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Cadastro</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {indicators.map(ind => (
                  <tr key={ind.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{ind.name}</td>
                    <td className="px-4 py-4 text-slate-600 font-mono text-sm">{ind.cpf}</td>
                    <td className="px-4 py-4 text-slate-600 text-sm">{ind.whatsapp}</td>
                    <td className="px-4 py-4 text-slate-600 text-sm">{ind.email || '—'}</td>
                    <td className="px-4 py-4 text-slate-500 text-sm">{fmtDate(ind.created_at)}</td>
                    <td className="px-4 py-4"><Badge status={ind.status} /></td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {activeTab === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(ind.id)}
                              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              Aprovar
                            </button>
                            <button
                              onClick={() => setRejectTarget(ind)}
                              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              Rejeitar
                            </button>
                          </>
                        )}
                        {activeTab === 'approved' && (
                          <button
                            onClick={() => handleSuspend(ind.id)}
                            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            Suspender
                          </button>
                        )}
                        {ind.rejection_reason && (
                          <span className="text-xs text-slate-400 max-w-[160px] truncate" title={ind.rejection_reason}>
                            {ind.rejection_reason}
                          </span>
                        )}
                      </div>
                    </td>
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
