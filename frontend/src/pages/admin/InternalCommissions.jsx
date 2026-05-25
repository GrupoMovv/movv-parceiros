import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Users, DollarSign, CheckCircle2, Clock, Plus, X,
  RotateCcw, ChevronDown, ChevronUp, Loader2, Eye,
  Pencil, Trash2, AlertTriangle, Lock, KeyRound, Copy,
} from 'lucide-react';

const fmt    = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = v => (parseFloat(v || 0) * 100).toFixed(1) + '%';
const currentMonth = new Date().toISOString().slice(0, 7);

const ROLE_LABEL = {
  manager_azul:   'Gerente Azul',
  comercial_full: 'Comercial Azul + Direta',
};

const CURVA_PABLINE = [
  { label: 'Até R$ 50k',        min: 0,      max: 50000,   pct: 0.05 },
  { label: 'R$ 50k – R$ 100k',  min: 50001,  max: 100000,  pct: 0.07 },
  { label: 'R$ 100k – R$ 200k', min: 100001, max: 200000,  pct: 0.06 },
  { label: 'R$ 200k – R$ 300k', min: 200001, max: 300000,  pct: 0.05 },
  { label: 'Acima R$ 300k',     min: 300001, max: Infinity, pct: 0.04 },
];

const CURVA_FERNANDO = [
  { label: 'Até R$ 50k',       min: 0,      max: 50000,   pct: 0.005 },
  { label: 'R$ 50k – R$ 100k', min: 50001,  max: 100000,  pct: 0.010 },
  { label: 'Acima R$ 100k',    min: 100001, max: Infinity, pct: 0.015 },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminInternalCommissions() {
  const [collaborators, setCollaborators] = useState([]);
  const [commissions,   setCommissions]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modalCollab,   setModalCollab]   = useState(null);
  const [modalEdit,     setModalEdit]     = useState(null);
  const [modalDelete,   setModalDelete]   = useState(null);
  const [deleting,      setDeleting]      = useState(false);
  const [expanded,      setExpanded]      = useState({});
  const [modalReset,    setModalReset]    = useState(null);          // collab obj → confirmar reset
  const [resetResult,   setResetResult]   = useState(null);          // { newPassword, collaboratorName, email }
  const [resetting,     setResetting]     = useState(false);

  const load = useCallback(async () => {
    try {
      const [collabRes, commRes] = await Promise.all([
        api.get('/internal-collaborators/collaborators'),
        api.get('/internal-collaborators/commissions'),
      ]);
      setCollaborators(collabRes.data);
      setCommissions(commRes.data);
    } catch { toast.error('Erro ao carregar dados'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markPaid(id) {
    try {
      await api.patch(`/internal-collaborators/commissions/${id}/paid`);
      toast.success('Marcado como pago!');
      load();
    } catch { toast.error('Erro ao marcar como pago'); }
  }

  async function revert(id) {
    try {
      await api.patch(`/internal-collaborators/commissions/${id}/revert`);
      toast.success('Pagamento estornado.');
      load();
    } catch { toast.error('Erro ao estornar'); }
  }

  async function confirmReset() {
    if (!modalReset) return;
    setResetting(true);
    try {
      const res = await api.post(`/internal-collaborators/reset-password/${modalReset.id}`);
      setModalReset(null);
      setResetResult(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao resetar senha');
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete() {
    if (!modalDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/internal-collaborators/commissions/${modalDelete.id}`);
      toast.success('Comissão excluída.');
      setModalDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao excluir');
    } finally { setDeleting(false); }
  }

  const commByCollab = id => commissions.filter(c => c.collaborator_id === id);

  const monthlyTotals = {
    paid:    commissions.filter(c => c.status === 'paid'    && c.month === currentMonth).reduce((s, c) => s + parseFloat(c.total_amount), 0),
    pending: commissions.filter(c => c.status === 'pending').reduce((s, c) => s + parseFloat(c.total_amount), 0),
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-[#4A0E8F]" />
          Comissões Internas
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Gerencie as comissões de Pabline e Fernando — lançamento manual mensal
        </p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          label="Pago este mês" value={monthlyTotals.paid}
          bg="bg-emerald-50" border="border-emerald-200" color="text-emerald-700" />
        <SummaryCard icon={<Clock className="w-5 h-5 text-amber-500" />}
          label="Total pendente" value={monthlyTotals.pending}
          bg="bg-amber-50" border="border-amber-200" color="text-amber-700" />
        <SummaryCard icon={<DollarSign className="w-5 h-5 text-[#4A0E8F]" />}
          label="Total projetado (mês)" value={monthlyTotals.paid + monthlyTotals.pending}
          bg="bg-purple-50" border="border-purple-200" color="text-[#4A0E8F]" />
      </div>

      {/* Tabela de referência rápida */}
      <TabelaReferencia />

      {/* Cards dos colaboradores */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#4A0E8F]" />
        </div>
      ) : collaborators.map(collab => (
        <CollabCard
          key={collab.id}
          collab={collab}
          commissions={commByCollab(collab.id)}
          onLaunch={() => setModalCollab(collab)}
          onReset={() => setModalReset(collab)}
          onPaid={markPaid}
          onRevert={revert}
          onEdit={commission => setModalEdit({ commission, collab })}
          onDelete={commission => setModalDelete(commission)}
          expanded={expanded[collab.id]}
          toggleExpand={() => setExpanded(p => ({ ...p, [collab.id]: !p[collab.id] }))}
        />
      ))}

      {modalCollab && (
        <LaunchModal
          collab={modalCollab}
          onClose={() => setModalCollab(null)}
          onSaved={() => { setModalCollab(null); load(); }}
        />
      )}

      {modalEdit && (
        <EditModal
          commission={modalEdit.commission}
          collab={modalEdit.collab}
          onClose={() => setModalEdit(null)}
          onSaved={() => { setModalEdit(null); load(); }}
        />
      )}

      {modalDelete && (
        <DeleteModal
          commission={modalDelete}
          loading={deleting}
          onClose={() => setModalDelete(null)}
          onConfirm={handleDelete}
        />
      )}

      {modalReset && (
        <ResetConfirmModal
          collab={modalReset}
          loading={resetting}
          onClose={() => setModalReset(null)}
          onConfirm={confirmReset}
        />
      )}

      {resetResult && (
        <ResetResultModal
          result={resetResult}
          onClose={() => setResetResult(null)}
        />
      )}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'paid') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
      <CheckCircle2 className="w-3 h-3" /> Pago
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
      <Clock className="w-3 h-3" /> Pendente
    </span>
  );
}

// ─── Action Buttons ───────────────────────────────────────────────────────────
function ActionButtons({ commission, onPaid, onRevert, onEdit, onDelete }) {
  const isPaid = commission.status === 'paid';
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => onEdit(commission)}
        disabled={isPaid}
        title={isPaid ? 'Estorne o pagamento primeiro' : 'Editar comissão'}
        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors
          ${isPaid
            ? 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'
            : 'border-purple-200 bg-purple-50 text-[#4A0E8F] hover:bg-purple-100'}`}
      >
        <Pencil className="w-3 h-3" /> Editar
      </button>

      {isPaid ? (
        <button
          onClick={() => onRevert(commission.id)}
          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Estornar
        </button>
      ) : (
        <button
          onClick={() => onPaid(commission.id)}
          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          <CheckCircle2 className="w-3 h-3" /> Pagar
        </button>
      )}

      <button
        onClick={() => !isPaid && onDelete(commission)}
        disabled={isPaid}
        title={isPaid ? 'Estorne o pagamento primeiro' : 'Excluir comissão'}
        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors
          ${isPaid
            ? 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'
            : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'}`}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Card do colaborador ──────────────────────────────────────────────────────
function CollabCard({ collab, commissions, onLaunch, onReset, onPaid, onRevert, onEdit, onDelete, expanded, toggleExpand }) {
  const latest = commissions[0];
  return (
    <div className="card !p-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-movv-gradient flex items-center justify-center text-white font-bold text-lg">
              {collab.name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-slate-900 text-lg">{collab.name}</p>
              <p className="text-xs text-[#C9A84C] font-semibold">{ROLE_LABEL[collab.role]}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Total pago</p>
            <p className="font-bold text-slate-900">{fmt(collab.total_paid)}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Pendente</p>
            <p className="font-bold text-amber-600">{fmt(collab.total_pending)}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400 text-xs uppercase tracking-wider">Meses</p>
            <p className="font-bold text-slate-900">{collab.commission_count}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onReset}
            title="Resetar senha deste colaborador"
            className="flex items-center gap-1.5 border border-slate-200 bg-white text-slate-600 text-sm font-semibold px-3 py-2 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <KeyRound className="w-4 h-4" />
            Resetar Senha
          </button>
          <button
            onClick={onLaunch}
            className="flex items-center gap-2 bg-movv-gradient text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Lançar Comissão
          </button>
          <button
            onClick={toggleExpand}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Último lançamento */}
      {latest && (
        <div className="px-6 pb-5 border-t border-slate-100 pt-4 bg-slate-50/50">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">
            Último lançamento — {latest.month}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
            <div>
              <p className="text-slate-400 text-xs">Fat. Azul</p>
              <p className="font-semibold text-slate-700">{fmt(latest.azul_revenue)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Comissão Azul</p>
              <p className="font-semibold text-slate-700">
                {fmt(latest.azul_commission)}{' '}
                <span className="text-xs font-normal text-slate-400">({fmtPct(latest.azul_commission_pct)})</span>
              </p>
            </div>
            {parseFloat(latest.direta_commission) > 0 && (
              <div>
                <p className="text-slate-400 text-xs">Comissão Direta</p>
                <p className="font-semibold text-slate-700">{fmt(latest.direta_commission)}</p>
              </div>
            )}
            <div>
              <p className="text-slate-400 text-xs">Total a receber</p>
              <p className="font-bold text-[#4A0E8F] text-base">{fmt(latest.total_amount)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={latest.status} />
            <ActionButtons
              commission={latest}
              onPaid={onPaid}
              onRevert={onRevert}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        </div>
      )}

      {/* Histórico expandido */}
      {expanded && commissions.length > 1 && (
        <div className="border-t border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Mês','Fat. Azul','% Azul','Com. Azul','Com. Direta','Salário','Total','Status','Ações'].map(h => (
                    <th key={h} className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commissions.slice(1).map(c => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-xs text-[#C9A84C]">{c.month}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(c.azul_revenue)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtPct(c.azul_commission_pct)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(c.azul_commission)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(c.direta_commission)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(c.base_salary)}</td>
                    <td className="px-4 py-3 font-bold text-[#4A0E8F]">{fmt(c.total_amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3">
                      <ActionButtons
                        commission={c}
                        onPaid={onPaid}
                        onRevert={onRevert}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────
function ModalShell({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{title}</h2>
            <p className="text-xs text-[#C9A84C] font-semibold mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Curva de Comissão (display) ─────────────────────────────────────────────
function CurvaDisplay({ curve, netValue, label }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Curva — {label}</p>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {curve.map((tier, i) => {
          const active = netValue >= tier.min && netValue <= tier.max;
          return (
            <div key={i} className={`rounded-lg px-3 py-2 text-xs ${active ? 'bg-movv-gradient text-white font-bold' : 'bg-slate-50 text-slate-600'}`}>
              <p className={active ? 'text-white/80' : 'text-slate-400'}>{tier.label}</p>
              <p className="font-bold text-sm mt-0.5">{(tier.pct * 100).toFixed(1)}%</p>
              {active && <p className="text-[10px] text-white/70 mt-0.5">← você está aqui</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Seguros — lista dinâmica (Fernando) ──────────────────────────────────────
const PCT_OPTIONS = Array.from({ length: 21 }, (_, i) => i + 10);

function SegurosList({ seguros, onChange }) {
  const list = seguros || [];
  function addRow() {
    if (list.length >= 10) return;
    onChange([...list, { id: Date.now(), descricao: '', valorOperado: 0, pctComissaoAzul: 10 }]);
  }
  function removeRow(id) { onChange(list.filter(s => s.id !== id)); }
  function updateRow(id, field, value) {
    onChange(list.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  const subtotal = list.reduce((sum, s) => {
    return sum + (parseFloat(s.valorOperado || 0) * parseFloat(s.pctComissaoAzul || 0) / 100) * 0.20;
  }, 0);

  return (
    <div className="border-t border-slate-100 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <p className="text-sm font-semibold text-slate-800">Seguros</p>
          <span className="text-xs text-slate-400">(Fernando = 20% do que Azul paga à Movv)</span>
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={list.length >= 10}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-[#4A0E8F] hover:bg-purple-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3 h-3" /> Adicionar
        </button>
      </div>

      {list.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3 italic">Nenhum seguro este mês</p>
      ) : (
        <>
          {list.map(s => (
            <div key={s.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Descrição (opcional)</label>
                    <input
                      type="text"
                      className="input mt-0.5 text-sm"
                      value={s.descricao}
                      onChange={e => updateRow(s.id, 'descricao', e.target.value)}
                      placeholder="Ex: Vida Empresarial"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Valor Operado</label>
                    <CurrencyInput
                      key={`val-${s.id}`}
                      value={s.valorOperado}
                      onChange={v => updateRow(s.id, 'valorOperado', v)}
                      className="input mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium">% Comissão Azul</label>
                    <select
                      className="input mt-0.5"
                      value={s.pctComissaoAzul}
                      onChange={e => updateRow(s.id, 'pctComissaoAzul', parseInt(e.target.value))}
                    >
                      {PCT_OPTIONS.map(p => <option key={p} value={p}>{p}%</option>)}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(s.id)}
                  className="mt-5 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {parseFloat(s.valorOperado) > 0 && (
                <p className="text-xs text-emerald-600 font-medium">
                  Fernando:{' '}
                  {((parseFloat(s.valorOperado) * parseFloat(s.pctComissaoAzul) / 100) * 0.20)
                    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  <span className="text-slate-400 font-normal ml-1">
                    ({parseFloat(s.valorOperado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} × {s.pctComissaoAzul}% × 20%)
                  </span>
                </p>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <span className="text-slate-600 font-medium">Subtotal seguros Fernando:</span>
            <span className="font-bold text-emerald-700">
              {subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Commission Form (compartilhado entre Launch e Edit) ─────────────────────
function CommissionForm({ form, set, collab, isPabline, isFernando, preview, loadPrev, onPreview }) {
  return (
    <div className="px-6 py-5 space-y-5">
      <div>
        <label className="label">Mês de referência</label>
        <input type="month" className="input" value={form.month} onChange={e => set('month', e.target.value)} />
      </div>

      {/* PABLINE: campo único de faturamento Azul */}
      {isPabline && (
        <>
          <div>
            <label className="label">Faturamento Bruto Azul</label>
            <CurrencyInput value={form.azul_revenue} onChange={v => set('azul_revenue', v)} placeholder="85.000,00" className="input" />
            <p className="text-xs text-slate-400 mt-1">
              Base = {(form.azul_revenue * 0.80).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (80% do bruto)
            </p>
          </div>
          <CurvaDisplay curve={CURVA_PABLINE} netValue={form.azul_revenue * 0.80} label="Pabline" />
        </>
      )}

      {/* FERNANDO: 3 seções de produto */}
      {isFernando && (
        <>
          {/* Azul Normal */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#4A0E8F]" />
              <p className="text-sm font-semibold text-slate-800">Azul — Produtos Normais</p>
              <span className="text-xs text-slate-400">(consignado, FGTS, etc.)</span>
            </div>
            <div>
              <label className="label">Faturamento Bruto</label>
              <CurrencyInput value={form.azul_normal_revenue || 0} onChange={v => set('azul_normal_revenue', v)} placeholder="85.000,00" className="input" />
              <p className="text-xs text-slate-400 mt-1">
                Base = {((form.azul_normal_revenue || 0) * 0.80).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (80% do bruto)
              </p>
            </div>
            <CurvaDisplay curve={CURVA_FERNANDO} netValue={(form.azul_normal_revenue || 0) * 0.80} label="Fernando — Azul Normal" />
          </div>

          {/* Seguros */}
          <SegurosList seguros={form.seguros} onChange={arr => set('seguros', arr)} />

          {/* Consórcios */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#C9A84C]" />
              <p className="text-sm font-semibold text-slate-800">Consórcios</p>
              <span className="text-xs text-slate-400">(Fernando = LL × 1,5%)</span>
            </div>
            <div>
              <label className="label">Valor Operado</label>
              <CurrencyInput value={form.consorcios_revenue || 0} onChange={v => set('consorcios_revenue', v)} placeholder="0,00" className="input" />
              <p className="text-xs text-emerald-600 mt-1 font-medium">
                Fernando:{' '}
                {((form.consorcios_revenue || 0) * 0.80 * 0.015).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                <span className="text-slate-400 font-normal ml-1">(valor × 80% × 1,5%)</span>
              </p>
            </div>
          </div>

          {/* Direta */}
          <div className="border-t border-slate-100 pt-4 space-y-4">
            <p className="text-sm font-semibold text-slate-700">
              Direta Certificação <span className="text-xs font-normal text-slate-400">(Fernando recebe 25% sobre cada base)</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Base via Contabilidade</label>
                <CurrencyInput value={form.base_via_accounting} onChange={v => set('base_via_accounting', v)} placeholder="venda − custo − com. cont." className="input" />
                <p className="text-xs text-emerald-600 mt-1 font-medium">
                  Fernando: {(form.base_via_accounting * 0.25).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div>
                <label className="label">Base Venda Direta</label>
                <CurrencyInput value={form.base_via_direct} onChange={v => set('base_via_direct', v)} placeholder="venda − custo" className="input" />
                <p className="text-xs text-emerald-600 mt-1 font-medium">
                  Fernando: {(form.base_via_direct * 0.25).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>
            <div>
              <label className="label">Qtd. certificados emitidos (total)</label>
              <IntegerInput value={form.cert_count} onChange={v => set('cert_count', v)} className="input w-40" />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
              <p className="font-semibold mb-1">Regra do Salário Fernando</p>
              <p>Se comissão total &lt; R$ 3.500 → salário R$ 1.621 é incluído</p>
              <p>Se comissão total ≥ R$ 3.500 → salário = R$ 0</p>
            </div>
          </div>
        </>
      )}

      <div>
        <label className="label">Observações (opcional)</label>
        <textarea className="input min-h-[60px] resize-none"
          placeholder="Ex: Fechamento do mês X, bônus por meta atingida..."
          value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      {/* Preview */}
      <div className="border-t border-slate-100 pt-4">
        <button
          onClick={onPreview}
          disabled={loadPrev}
          className="flex items-center gap-2 text-sm text-[#4A0E8F] border border-purple-200 bg-purple-50 px-4 py-2 rounded-xl hover:bg-purple-100 transition-colors disabled:opacity-50"
        >
          {loadPrev ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          Calcular preview
        </button>

        {preview && (
          <div className="mt-4 bg-[#F8F4FF] border border-purple-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-[#4A0E8F] uppercase tracking-wider">Preview do Cálculo</p>

            {isPabline && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <PreviewItem label="Base líquida"  value={fmt(preview.net_revenue)} />
                <PreviewItem label="% Azul"        value={fmtPct(preview.azul_commission_pct)} />
                <PreviewItem label="Comissão Azul" value={fmt(preview.azul_commission)} />
                <PreviewItem label="Salário base"  value={fmt(preview.base_salary)} />
              </div>
            )}

            {isFernando && (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <PreviewItem label="Azul Normal LL"    value={fmt(preview.net_revenue)} />
                  <PreviewItem label="% Azul Normal"     value={fmtPct(preview.azul_commission_pct)} />
                  <PreviewItem label="Com. Azul Normal"  value={fmt(preview.azul_normal_commission)} />
                </div>
                {parseFloat(preview.seguros_commission) > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <PreviewItem label="Seguros (Azul→Movv)" value={fmt(preview.seguros_total_revenue)} />
                    <PreviewItem label="Com. Seguros (20%)"  value={fmt(preview.seguros_commission)} />
                  </div>
                )}
                {parseFloat(preview.consorcios_commission) > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <PreviewItem label="Consórcios"      value={fmt(preview.consorcios_revenue)} />
                    <PreviewItem label="Com. Consórcios" value={fmt(preview.consorcios_commission)} />
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <PreviewItem label="Total Azul"   value={fmt(preview.azul_commission)} />
                  <PreviewItem label="Com. Direta"  value={fmt(preview.direta_commission)} />
                  <PreviewItem label="Salário base" value={fmt(preview.base_salary)} />
                </div>
              </div>
            )}

            <div className="border-t border-purple-200 pt-3 flex items-center justify-between">
              <p className="text-slate-600 text-sm font-semibold">Total a receber</p>
              <p className="text-[#4A0E8F] font-bold text-xl">{fmt(preview.total_amount)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Launch Modal ─────────────────────────────────────────────────────────────
function LaunchModal({ collab, onClose, onSaved }) {
  const isPabline  = collab.role === 'manager_azul';
  const isFernando = collab.role === 'comercial_full';

  const [form, setForm] = useState({
    month: currentMonth, azul_revenue: 0,
    azul_normal_revenue: 0, seguros: [], consorcios_revenue: 0,
    base_via_accounting: 0, base_via_direct: 0, cert_count: 0, notes: '',
  });
  const [preview,  setPreview]  = useState(null);
  const [loadPrev, setLoadPrev] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function loadPreview() {
    setLoadPrev(true);
    try {
      const res = await api.post('/internal-collaborators/commissions/preview', {
        collaborator_id:      collab.id,
        azul_revenue:         form.azul_revenue,
        azul_normal_revenue:  form.azul_normal_revenue,
        seguros_data:         form.seguros || [],
        consorcios_revenue:   form.consorcios_revenue,
        base_via_accounting:  form.base_via_accounting,
        base_via_direct:      form.base_via_direct,
        cert_count:           form.cert_count,
      });
      setPreview(res.data);
    } catch { toast.error('Erro no preview'); }
    finally { setLoadPrev(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.post('/internal-collaborators/commissions', {
        collaborator_id:      collab.id,
        month:                form.month,
        azul_revenue:         form.azul_revenue,
        azul_normal_revenue:  form.azul_normal_revenue,
        seguros_data:         form.seguros || [],
        consorcios_revenue:   form.consorcios_revenue,
        base_via_accounting:  form.base_via_accounting,
        base_via_direct:      form.base_via_direct,
        cert_count:           form.cert_count,
        notes:                form.notes || null,
      });
      toast.success(`Comissão de ${collab.name} lançada com sucesso!`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  return (
    <ModalShell title={`Lançar Comissão — ${collab.name}`} subtitle={ROLE_LABEL[collab.role]} onClose={onClose}>
      <CommissionForm form={form} set={set} collab={collab}
        isPabline={isPabline} isFernando={isFernando}
        preview={preview} loadPrev={loadPrev} onPreview={loadPreview} />
      <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={handleSave} disabled={saving}
          className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar Lançamento
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ commission, collab, onClose, onSaved }) {
  const isPaid     = commission.status === 'paid';
  const isPabline  = collab.role === 'manager_azul';
  const isFernando = collab.role === 'comercial_full';

  // Pré-preenche com valores numéricos.
  // base_via_accounting/direct: DB guarda resultado (25% da base), revertemos dividindo por 0.25.
  // seguros_data vem do DB como JSONB; adicionamos id local para o key do React.
  const rawSeguros = Array.isArray(commission.seguros_data) ? commission.seguros_data : [];
  const [form, setForm] = useState({
    month:                commission.month,
    azul_revenue:         parseFloat(commission.azul_revenue         || 0),
    azul_normal_revenue:  parseFloat(commission.azul_normal_revenue  || 0),
    seguros:              rawSeguros.map((s, i) => ({ ...s, id: Date.now() + i })),
    consorcios_revenue:   parseFloat(commission.consorcios_revenue   || 0),
    base_via_accounting:  parseFloat(commission.direta_via_accounting || 0) / 0.25,
    base_via_direct:      parseFloat(commission.direta_via_direct     || 0) / 0.25,
    cert_count:           parseInt(commission.direta_certificates_count || 0),
    notes:                commission.notes || '',
  });
  const [preview,  setPreview]  = useState(null);
  const [loadPrev, setLoadPrev] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function loadPreview() {
    setLoadPrev(true);
    try {
      const res = await api.post('/internal-collaborators/commissions/preview', {
        collaborator_id:      collab.id,
        azul_revenue:         form.azul_revenue,
        azul_normal_revenue:  form.azul_normal_revenue,
        seguros_data:         form.seguros || [],
        consorcios_revenue:   form.consorcios_revenue,
        base_via_accounting:  form.base_via_accounting,
        base_via_direct:      form.base_via_direct,
        cert_count:           form.cert_count,
      });
      setPreview(res.data);
    } catch { toast.error('Erro no preview'); }
    finally { setLoadPrev(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/internal-collaborators/commissions/${commission.id}`, {
        month:                form.month,
        azul_revenue:         form.azul_revenue,
        azul_normal_revenue:  form.azul_normal_revenue,
        seguros_data:         form.seguros || [],
        consorcios_revenue:   form.consorcios_revenue,
        base_via_accounting:  form.base_via_accounting,
        base_via_direct:      form.base_via_direct,
        cert_count:           form.cert_count,
        notes:                form.notes || null,
      });
      toast.success(`Comissão de ${collab.name} atualizada!`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  if (isPaid) {
    return (
      <ModalShell title={`Editar Comissão — ${collab.name}`} subtitle={ROLE_LABEL[collab.role]} onClose={onClose}>
        <div className="px-6 py-10 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <Lock className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-lg">Comissão já paga</p>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">
              Esta comissão já foi marcada como paga. Para editar, primeiro estorne o pagamento usando o botão <strong>"Estornar"</strong>.
            </p>
          </div>
          <StatusBadge status="paid" />
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Fechar</button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title={`Editar Comissão — ${collab.name}`}
      subtitle={`${ROLE_LABEL[collab.role]} · ${commission.month}`}
      onClose={onClose}
    >
      <CommissionForm form={form} set={set} collab={collab}
        isPabline={isPabline} isFernando={isFernando}
        preview={preview} loadPrev={loadPrev} onPreview={loadPreview} />
      <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={handleSave} disabled={saving}
          className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar Alterações
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function DeleteModal({ commission, loading, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Excluir Comissão</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {commission.collaborator_name} · {commission.month}
              </p>
            </div>
          </div>
          <p className="text-slate-600 text-sm mt-4 leading-relaxed">
            Tem certeza? Esta ação <strong>não pode ser desfeita</strong>. O registro de{' '}
            <strong className="text-[#4A0E8F]">{fmt(commission.total_amount)}</strong> será excluído permanentemente.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="btn-secondary">Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Sim, excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SummaryCard({ icon, label, value, bg, border, color }) {
  return (
    <div className={`rounded-2xl p-4 border ${bg} ${border} flex flex-col gap-1`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className={`font-bold text-xl ${color}`}>{fmt(value)}</p>
    </div>
  );
}

function PreviewItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold text-slate-800">{value}</p>
    </div>
  );
}

// ─── CurrencyInput — máscara BRL enquanto digita ──────────────────────────────
// Armazena o valor bruto (número) no form; exibe formatado localmente.
// Ex.: digitar "1000" → exibe "R$ 10,00" | digitar "100000" → "R$ 1.000,00"
function CurrencyInput({ value, onChange, placeholder, className }) {
  const toDisplay = raw => {
    const n = parseFloat(raw);
    if (!n || isNaN(n)) return '';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const [display, setDisplay] = useState(() => toDisplay(value));

  const handleChange = e => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) { setDisplay(''); onChange(0); return; }
    const num = parseInt(digits, 10) / 100;
    setDisplay(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    onChange(num);
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none select-none">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        className={`${className} pl-9`}
        value={display}
        onChange={handleChange}
        placeholder={placeholder || '0,00'}
      />
    </div>
  );
}

// ─── IntegerInput — separador de milhar, sem decimais ────────────────────────
function IntegerInput({ value, onChange, placeholder, className }) {
  const toDisplay = raw => {
    const n = parseInt(raw);
    if (!n || isNaN(n)) return '';
    return n.toLocaleString('pt-BR');
  };

  const [display, setDisplay] = useState(() => toDisplay(value));

  const handleChange = e => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) { setDisplay(''); onChange(0); return; }
    const num = parseInt(digits, 10);
    setDisplay(num.toLocaleString('pt-BR'));
    onChange(num);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      value={display}
      onChange={handleChange}
      placeholder={placeholder || '0'}
    />
  );
}

// ─── Reset Password Modals ────────────────────────────────────────────────────
function ResetConfirmModal({ collab, loading, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <KeyRound className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Resetar Senha</h2>
              <p className="text-xs text-slate-500 mt-0.5">{collab.name}</p>
            </div>
          </div>
          <p className="text-slate-600 text-sm mt-4 leading-relaxed">
            Tem certeza que deseja resetar a senha de <strong>{collab.name}</strong>?
          </p>
          <p className="text-slate-500 text-sm mt-1 leading-relaxed">
            Será gerada uma nova senha temporária que você deverá comunicar ao colaborador
            via canal seguro.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="btn-secondary">Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Sim, resetar
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetResultModal({ result, onClose }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(result.newPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 pt-6 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <KeyRound className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="font-bold text-slate-900 text-lg">Nova Senha Gerada</h2>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1 text-sm text-slate-600">
            <p><span className="font-medium">Colaborador:</span> {result.collaboratorName}</p>
            <p><span className="font-medium">E-mail:</span> {result.email}</p>
          </div>

          <div className="bg-[#F3EEFF] border border-purple-200 rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Senha temporária</p>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono font-bold text-2xl text-[#4A0E8F] tracking-widest select-all">
                {result.newPassword}
              </span>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border transition-all ${
                  copied
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">IMPORTANTE</p>
            <p>Anote esta senha agora. Ela não poderá ser visualizada de novo.</p>
            <p>Envie ao colaborador via canal seguro. Na próxima vez que ele fizer login, será obrigado a criar uma nova senha.</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="btn-primary">Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Tabela de Referência (colapsável) ────────────────────────────────────────
function TabelaReferencia() {
  const [open, setOpen] = useState(false);

  return (
    <div className="card !p-0 overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-slate-900">📊 Tabelas de Comissão</span>
          <span className="text-xs text-slate-400 font-normal">(referência rápida)</span>
        </div>
        {open
          ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
          : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-5 space-y-6">
          {/* Pabline */}
          <div>
            <p className="font-bold text-slate-900 mb-3">👔 PABLINE — Gerente Azul</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 mb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Faixa Faturamento</th>
                    <th className="text-right px-4 py-2.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">% Comis.</th>
                  </tr>
                </thead>
                <tbody>
                  {CURVA_PABLINE.map((tier, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 text-slate-700">{tier.label}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#4A0E8F]">
                        {(tier.pct * 100).toFixed(1)}%
                        {tier.pct === 0.07 && <span className="ml-1 text-[#C9A84C]">⭐</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Salário base: <strong>R$ 1.621</strong> · Aplica em <strong>TODAS</strong> as vendas Azul
            </p>
          </div>

          <hr className="border-slate-200" />

          {/* Fernando */}
          <div>
            <p className="font-bold text-slate-900 mb-3">💼 FERNANDO — Comercial</p>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">AZUL (suas vendas):</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Faixa Faturamento</th>
                    <th className="text-right px-4 py-2.5 text-slate-500 font-semibold text-xs uppercase tracking-wider">% Comis.</th>
                  </tr>
                </thead>
                <tbody>
                  {CURVA_FERNANDO.map((tier, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 text-slate-700">{tier.label}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#4A0E8F]">{(tier.pct * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">DIRETA:</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2 mb-3">
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-600 font-bold mt-0.5">•</span>
                <div>
                  <span className="text-slate-700 font-medium">Via contabilidade: </span>
                  <span className="text-slate-600">25% sobre lucro líquido</span>
                  <p className="text-xs text-slate-400 mt-0.5">(após descontar a comissão da contabilidade)</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-amber-600 font-bold mt-0.5">•</span>
                <div>
                  <span className="text-slate-700 font-medium">Venda direta: </span>
                  <span className="text-slate-600">25% sobre lucro bruto</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Salário base: <strong>R$ 1.621</strong>{' '}
              <span className="text-slate-400">(até comissão &lt; R$ 3.500)</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
