import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Users, CheckCircle, XCircle, AlertCircle, Clock,
  FileText, CreditCard, DollarSign,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function fmtBRL(v) {
  if (v == null) return '—';
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Badges ──────────────────────────────────────────────────────────────────

function IndicatorBadge({ status }) {
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

function ReferralBadge({ status }) {
  const map = {
    pending:     'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    approved:    'bg-green-100 text-green-700',
    cancelled:   'bg-slate-100 text-slate-500',
    expired:     'bg-red-100 text-red-700',
  };
  const labels = {
    pending:     'Pendente',
    in_progress: 'Em andamento',
    approved:    'Aprovada',
    cancelled:   'Cancelada',
    expired:     'Expirada',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-500'}`}>
      {labels[status] || status}
    </span>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function RejectIndicatorModal({ indicator, onClose, onReject }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handle() {
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
        <label className="block text-xs text-white/60 font-semibold uppercase tracking-wider mb-1.5">Motivo</label>
        <textarea
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Descreva o motivo..."
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-red-500 resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/70 hover:text-white text-sm font-semibold">Cancelar</button>
          <button onClick={handle} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm">
            {loading ? 'Rejeitando...' : 'Rejeitar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApproveReferralModal({ referral, onClose, onApprove }) {
  const [commission, setCommission] = useState(
    referral.commission_value != null ? String(parseFloat(referral.commission_value).toFixed(2)) : ''
  );
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    await onApprove(referral.id, commission);
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-white font-bold text-lg mb-1">Aprovar Indicação</h3>
        <div className="bg-white/5 rounded-xl p-4 mb-4 space-y-1 text-sm">
          <p className="text-white/60">Indicador: <span className="text-white font-medium">{referral.indicator_name}</span></p>
          <p className="text-white/60">Cliente: <span className="text-white font-medium">{referral.client_name}</span></p>
          <p className="text-white/60">Produto: <span className="text-white font-medium">{referral.product_name}</span></p>
          {referral.estimated_value && (
            <p className="text-white/60">Valor estimado: <span className="text-white font-medium">{fmtBRL(referral.estimated_value)}</span></p>
          )}
        </div>
        <label className="block text-xs text-white/60 font-semibold uppercase tracking-wider mb-1.5">
          Valor da comissão (R$)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={commission}
          onChange={e => setCommission(e.target.value)}
          placeholder="Ex: 150.00"
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-green-500 text-lg font-semibold"
        />
        <p className="text-white/40 text-xs mt-1">Deixe em branco para aprovar sem comissão</p>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/70 hover:text-white text-sm font-semibold">Cancelar</button>
          <button onClick={handle} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-sm">
            {loading ? 'Aprovando...' : 'Aprovar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatePaymentModal({ indicator, onClose, onPay }) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    await onPay(indicator);
    setLoading(false);
    onClose();
  }

  const referrals = (indicator.referrals || []).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-white font-bold text-lg mb-1">Registrar Pagamento PIX</h3>
        <div className="bg-white/5 rounded-xl p-4 mb-4 space-y-1 text-sm">
          <p className="text-white/60">Indicador: <span className="text-white font-medium">{indicator.name}</span></p>
          <p className="text-white/60">CPF: <span className="text-white font-mono">{indicator.cpf}</span></p>
          <p className="text-white/60">PIX ({indicator.pix_key_type}): <span className="text-white font-medium break-all">{indicator.pix_key}</span></p>
          <p className="text-white/60">Indicações aprovadas: <span className="text-white font-medium">{referrals.length}</span></p>
          <p className="text-white/60 pt-1 border-t border-white/10">Valor a pagar:
            <span className="text-green-400 font-black text-base ml-2">{fmtBRL(indicator.pending_amount)}</span>
          </p>
        </div>
        <p className="text-white/50 text-xs mb-4">Confirme que o PIX foi enviado antes de registrar o pagamento.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/70 hover:text-white text-sm font-semibold">Cancelar</button>
          <button onClick={handle} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-sm">
            {loading ? 'Registrando...' : 'Confirmar Pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Indicadores ─────────────────────────────────────────────────────

const IND_TABS = [
  { key: 'pending',   label: 'Pendentes',  icon: Clock,         color: 'text-yellow-400' },
  { key: 'approved',  label: 'Aprovados',  icon: CheckCircle,   color: 'text-green-400'  },
  { key: 'rejected',  label: 'Rejeitados', icon: XCircle,       color: 'text-red-400'    },
  { key: 'suspended', label: 'Suspensos',  icon: AlertCircle,   color: 'text-orange-400' },
];

function SectionIndicadores() {
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
      IND_TABS.forEach(t => { c[t.key] = all.filter(i => i.status === t.key).length; });
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
      fetchTab(); fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao aprovar');
    }
  }

  async function handleReject(id, reason) {
    try {
      await api.put(`/indicators/${id}/reject`, { rejection_reason: reason });
      toast.success('Indicador rejeitado');
      fetchTab(); fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao rejeitar');
    }
  }

  async function handleSuspend(id) {
    if (!confirm('Suspender este indicador?')) return;
    try {
      await api.put(`/indicators/${id}/suspend`);
      toast.success('Indicador suspenso');
      fetchTab(); fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao suspender');
    }
  }

  return (
    <div className="space-y-4">
      {rejectTarget && (
        <RejectIndicatorModal
          indicator={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onReject={handleReject}
        />
      )}

      <div className="flex gap-2 flex-wrap">
        {IND_TABS.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === key ? 'bg-[#0C2D48] text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Icon className={`w-4 h-4 ${activeTab === key ? 'text-white' : color}`} />
            {label}
            {counts[key] > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold leading-none ${activeTab === key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#0C2D48] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : indicators.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Nenhum indicador {IND_TABS.find(t => t.key === activeTab)?.label.toLowerCase()}</p>
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
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Chave PIX</th>
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
                    <td className="px-4 py-4 text-slate-600 text-xs">
                      <span className="font-mono">{ind.pix_key}</span>
                      <span className="ml-1 text-slate-400">({ind.pix_key_type})</span>
                    </td>
                    <td className="px-4 py-4 text-slate-500 text-sm">{fmtDate(ind.created_at)}</td>
                    <td className="px-4 py-4"><IndicatorBadge status={ind.status} /></td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {ind.status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(ind.id)} className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors">Aprovar</button>
                            <button onClick={() => setRejectTarget(ind)} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors">Rejeitar</button>
                          </>
                        )}
                        {ind.status === 'approved' && (
                          <button onClick={() => handleSuspend(ind.id)} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors">Suspender</button>
                        )}
                        {ind.rejection_reason && (
                          <span className="text-xs text-slate-400 max-w-[160px] truncate" title={ind.rejection_reason}>{ind.rejection_reason}</span>
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

// ─── Section: Indicações ──────────────────────────────────────────────────────

const REF_TABS = [
  { key: '',            label: 'Todas'        },
  { key: 'pending',     label: 'Pendentes'    },
  { key: 'in_progress', label: 'Em andamento' },
  { key: 'approved',    label: 'Aprovadas'    },
  { key: 'cancelled',   label: 'Canceladas'   },
];

function SectionIndicacoes() {
  const [filterStatus, setFilterStatus] = useState('pending');
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterStatus ? `/indicators/all-referrals?status=${filterStatus}` : '/indicators/all-referrals';
      const res = await api.get(url);
      setReferrals(res.data);
    } catch {
      toast.error('Erro ao carregar indicações');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

  async function handleApprove(id, commissionValue) {
    try {
      await api.put(`/indicators/referrals/${id}/approve`, { commission_value: commissionValue || null });
      toast.success('Indicação aprovada! Comissão creditada ao indicador.');
      fetchReferrals();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao aprovar indicação');
    }
  }

  async function handleCancel(id) {
    if (!confirm('Cancelar esta indicação?')) return;
    try {
      await api.put(`/indicators/referrals/${id}/cancel`);
      toast.success('Indicação cancelada');
      fetchReferrals();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao cancelar');
    }
  }

  return (
    <div className="space-y-4">
      {approveTarget && (
        <ApproveReferralModal
          referral={approveTarget}
          onClose={() => setApproveTarget(null)}
          onApprove={handleApprove}
        />
      )}

      <div className="flex gap-2 flex-wrap">
        {REF_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filterStatus === key ? 'bg-[#0C2D48] text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#0C2D48] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Nenhuma indicação encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Indicador</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">CPF Cliente</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Produto</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Valor est.</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Comissão</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Data</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {referrals.map(ref => (
                  <tr key={ref.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900 text-sm">{ref.indicator_name}</p>
                      <p className="text-slate-400 text-xs font-mono">{ref.indicator_cpf}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-slate-800 font-medium text-sm">{ref.client_name}</p>
                      <p className="text-slate-400 text-xs">{ref.client_whatsapp}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600 font-mono text-sm">{ref.client_cpf}</td>
                    <td className="px-4 py-4 text-slate-700 text-sm max-w-[160px]">
                      <p className="truncate">{ref.product_name}</p>
                      {ref.product_category && <p className="text-xs text-slate-400 capitalize">{ref.product_category}</p>}
                    </td>
                    <td className="px-4 py-4 text-slate-600 text-sm">{fmtBRL(ref.estimated_value)}</td>
                    <td className="px-4 py-4 text-sm">
                      {ref.commission_value
                        ? <span className="text-green-600 font-bold">{fmtBRL(ref.commission_value)}</span>
                        : <span className="text-slate-400">—</span>}
                      {ref.commission_pct && (
                        <p className="text-slate-400 text-xs">{(ref.commission_pct * 100).toFixed(1)}%</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-500 text-sm">{fmtDate(ref.created_at)}</td>
                    <td className="px-4 py-4"><ReferralBadge status={ref.status} /></td>
                    <td className="px-6 py-4 text-right">
                      {(ref.status === 'pending' || ref.status === 'in_progress') && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setApproveTarget(ref)}
                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            Aprovar
                          </button>
                          <button
                            onClick={() => handleCancel(ref.id)}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                      {ref.notes && ref.status === 'cancelled' && (
                        <span className="text-xs text-slate-400">{ref.notes}</span>
                      )}
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

// ─── Section: Pagamentos ──────────────────────────────────────────────────────

function SectionPagamentos() {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payTarget, setPayTarget] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, hRes] = await Promise.all([
        api.get('/indicators/payments/pending'),
        api.get('/indicators/payments'),
      ]);
      setPending(pRes.data);
      setHistory(hRes.data);
    } catch {
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleCreatePayment(indicator) {
    try {
      const referralIds = (indicator.referrals || []).filter(Boolean).map(r => r.id);
      await api.post('/indicators/payments', {
        indicator_id: indicator.id,
        referral_ids: referralIds,
        total_amount: indicator.pending_amount,
        pix_key: indicator.pix_key,
        pix_key_type: indicator.pix_key_type,
      });
      toast.success('Pagamento registrado com sucesso!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao registrar pagamento');
    }
  }

  async function handleMarkPaid(paymentId) {
    if (!confirm('Confirmar que o PIX foi enviado e marcar como pago?')) return;
    try {
      await api.put(`/indicators/payments/${paymentId}/pay`);
      toast.success('Pagamento confirmado!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao confirmar pagamento');
    }
  }

  return (
    <div className="space-y-6">
      {payTarget && (
        <CreatePaymentModal
          indicator={payTarget}
          onClose={() => setPayTarget(null)}
          onPay={handleCreatePayment}
        />
      )}

      {/* A Pagar */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-500" />
          A Pagar (saldo ≥ R$ 50)
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-7 h-7 border-2 border-[#0C2D48] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pending.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 text-center py-10 text-slate-500">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>Nenhum pagamento pendente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map(ind => (
              <div key={ind.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-900">{ind.name}</p>
                    <p className="text-slate-500 text-xs font-mono">{ind.cpf}</p>
                  </div>
                  <span className="text-2xl font-black text-green-600">{fmtBRL(ind.pending_amount)}</span>
                </div>
                <div className="text-xs text-slate-500 space-y-0.5 mb-4">
                  <p>PIX ({ind.pix_key_type}): <span className="font-medium text-slate-700 break-all">{ind.pix_key}</span></p>
                  {ind.whatsapp && <p>WhatsApp: {ind.whatsapp}</p>}
                  <p>Indicações aprovadas: {(ind.referrals || []).filter(Boolean).length}</p>
                </div>
                <button
                  onClick={() => setPayTarget(ind)}
                  className="w-full py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  Registrar Pagamento PIX
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-slate-500" />
          Histórico de Pagamentos
        </h2>
        {history.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 text-center py-10 text-slate-400">
            <p>Nenhum pagamento registrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Indicador</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Chave PIX</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Valor</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Data</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map(pay => (
                    <tr key={pay.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900 text-sm">{pay.indicator_name}</p>
                        <p className="text-slate-400 text-xs font-mono">{pay.indicator_cpf}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-600 text-sm">
                        <p className="font-mono text-xs break-all">{pay.pix_key}</p>
                        {pay.pix_key_type && <p className="text-slate-400 text-xs">{pay.pix_key_type}</p>}
                      </td>
                      <td className="px-4 py-4 font-bold text-green-600">{fmtBRL(pay.total_amount)}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          pay.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {pay.status === 'paid' ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-500 text-sm">{fmtDate(pay.paid_at || pay.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        {pay.status !== 'paid' && (
                          <button
                            onClick={() => handleMarkPaid(pay.id)}
                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            Marcar Pago
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const MAIN_TABS = [
  { key: 'indicadores', label: 'Indicadores', icon: Users,     desc: 'Cadastros pendentes/aprovados' },
  { key: 'indicacoes',  label: 'Indicações',  icon: FileText,  desc: 'Aprovar indicações e comissões' },
  { key: 'pagamentos',  label: 'Pagamentos',  icon: CreditCard, desc: 'Liberar pagamentos via PIX' },
];

export default function AdminIndicadores() {
  const [mainTab, setMainTab] = useState('indicadores');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#0C2D48]/20 rounded-xl flex items-center justify-center">
          <Users className="w-5 h-5 text-[#0C2D48]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Programa Indique Azul e Ganhe</h1>
          <p className="text-slate-500 text-sm">Gerencie indicadores, indicações e pagamentos</p>
        </div>
      </div>

      {/* Main Nav */}
      <div className="flex gap-3 flex-wrap border-b border-slate-200 pb-0">
        {MAIN_TABS.map(({ key, label, icon: Icon, desc }) => (
          <button
            key={key}
            onClick={() => setMainTab(key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
              mainTab === key
                ? 'border-[#0C2D48] text-[#0C2D48]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Section Content */}
      {mainTab === 'indicadores' && <SectionIndicadores />}
      {mainTab === 'indicacoes'  && <SectionIndicacoes />}
      {mainTab === 'pagamentos'  && <SectionPagamentos />}
    </div>
  );
}
