import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import CurrencyInput from '../../components/ui/CurrencyInput';
import {
  Users, DollarSign, CheckCircle2, Clock, Plus, X,
  RotateCcw, ChevronDown, ChevronUp, Loader2, Eye,
  Pencil, Trash2, AlertTriangle, Lock, KeyRound, Copy, ShieldCheck,
} from 'lucide-react';

const fmt    = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = v => (parseFloat(v || 0) * 100).toFixed(1) + '%';
const currentMonth = new Date().toISOString().slice(0, 7);

const ROLE_LABEL = {
  manager_azul:   'Gerente Azul',
  comercial_full: 'Direta Certificação',
};

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
          <Users className="w-6 h-6 text-[#0C2D48]" />
          Comissões Internas
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Gerencie a comissão de Pabline — lançamento manual mensal. Fernando agora usa o módulo Direta Certificação.
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
        <SummaryCard icon={<DollarSign className="w-5 h-5 text-[#0C2D48]" />}
          label="Total projetado (mês)" value={monthlyTotals.paid + monthlyTotals.pending}
          bg="bg-blue-50" border="border-blue-200" color="text-[#0C2D48]" />
      </div>

      {/* Tabela de referência rápida */}
      <TabelaReferencia />

      {/* Cards dos colaboradores */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#0C2D48]" />
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
function ActionButtons({ commission, canEdit, onPaid, onRevert, onEdit, onDelete }) {
  const isPaid = commission.status === 'paid';
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {canEdit && (
        <button
          onClick={() => onEdit(commission)}
          disabled={isPaid}
          title={isPaid ? 'Estorne o pagamento primeiro' : 'Editar comissão'}
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors
            ${isPaid
              ? 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'
              : 'border-blue-200 bg-blue-50 text-[#0C2D48] hover:bg-blue-100'}`}
        >
          <Pencil className="w-3 h-3" /> Editar
        </button>
      )}

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
  const canLaunchEdit = collab.role !== 'comercial_full'; // Fernando: fluxo antigo desativado (usa módulo Direta)

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
          {canLaunchEdit && (
            <button
              onClick={onLaunch}
              className="flex items-center gap-2 bg-movv-gradient text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Lançar Comissão
            </button>
          )}
          {commissions.length > 0 && (
            <button
              onClick={toggleExpand}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {!canLaunchEdit && (
        <div className="mx-6 mb-5 flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <ShieldCheck className="w-4 h-4 text-[#0C2D48] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#0C2D48]">
            O histórico abaixo é somente leitura. Novos fechamentos de folha do Fernando são feitos em{' '}
            <strong>Admin &gt; Direta Certificação</strong>.
          </p>
        </div>
      )}

      {/* Último lançamento */}
      {latest && (
        <div className="px-6 pb-5 border-t border-slate-100 pt-4 bg-slate-50/50">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">
            Último lançamento — {latest.month}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
            <div>
              <p className="text-slate-400 text-xs">Com. Azul (10%)</p>
              <p className="font-semibold text-slate-700">{fmt(latest.azul_commission)}</p>
            </div>
            {parseFloat(latest.direta_commission) > 0 && (
              <div>
                <p className="text-slate-400 text-xs">Comissão Direta</p>
                <p className="font-semibold text-slate-700">{fmt(latest.direta_commission)}</p>
              </div>
            )}
            <div>
              <p className="text-slate-400 text-xs">Salário base</p>
              <p className="font-semibold text-slate-700">{fmt(latest.base_salary)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Total a receber</p>
              <p className="font-bold text-[#0C2D48] text-base">{fmt(latest.total_amount)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={latest.status} />
            <ActionButtons
              commission={latest}
              canEdit={canLaunchEdit}
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
                  {['Mês','Com. Azul','Com. Direta','Salário','Total','Status','Ações'].map(h => (
                    <th key={h} className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commissions.slice(1).map(c => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-xs text-[#C9A84C]">{c.month}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(c.azul_commission)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(c.direta_commission)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(c.base_salary)}</td>
                    <td className="px-4 py-3 font-bold text-[#0C2D48]">{fmt(c.total_amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3">
                      <ActionButtons
                        commission={c}
                        canEdit={canLaunchEdit}
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

// ─── Commission Form — Pabline (10% fixo sobre a comissão Azul do mês) ────────
function CommissionForm({ form, set, preview, loadPrev, onPreview }) {
  return (
    <div className="px-6 py-5 space-y-5">
      <div>
        <label className="label">Mês de referência</label>
        <input type="month" className="input" value={form.month} onChange={e => set('month', e.target.value)} />
      </div>

      <div>
        <label className="label">Total Comissão Azul Recebida no Mês</label>
        <CurrencyInput value={form.azul_revenue} onChange={v => set('azul_revenue', v)} placeholder="10.000,00" />
        <p className="text-xs text-slate-400 mt-1">
          Valor total que a Azul já pagou à Movv neste mês (bruto, sem desconto).
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Comissão da Pabline</span>
        <span className="font-bold text-[#0C2D48]">10% fixo</span>
      </div>

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
          className="flex items-center gap-2 text-sm text-[#0C2D48] border border-blue-200 bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50"
        >
          {loadPrev ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          Calcular preview
        </button>

        {preview && (
          <div className="mt-4 bg-[#F8F4FF] border border-blue-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-[#0C2D48] uppercase tracking-wider">Preview do Cálculo</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <PreviewItem label="Comissão Azul (100%)" value={fmt(preview.azul_revenue)} />
              <PreviewItem label="% Pabline"            value={fmtPct(preview.azul_commission_pct)} />
              <PreviewItem label="Comissão Pabline"     value={fmt(preview.azul_commission)} />
              <PreviewItem label="Salário base"         value={fmt(preview.base_salary)} />
            </div>

            <div className="border-t border-blue-200 pt-3 flex items-center justify-between">
              <p className="text-slate-600 text-sm font-semibold">Total a receber</p>
              <p className="text-[#0C2D48] font-bold text-xl">{fmt(preview.total_amount)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Launch Modal ─────────────────────────────────────────────────────────────
function LaunchModal({ collab, onClose, onSaved }) {
  const [form, setForm] = useState({ month: currentMonth, azul_revenue: 0, notes: '' });
  const [preview,  setPreview]  = useState(null);
  const [loadPrev, setLoadPrev] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function loadPreview() {
    setLoadPrev(true);
    try {
      const res = await api.post('/internal-collaborators/commissions/preview', {
        collaborator_id: collab.id,
        azul_revenue:    form.azul_revenue,
      });
      setPreview(res.data);
    } catch { toast.error('Erro no preview'); }
    finally { setLoadPrev(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.post('/internal-collaborators/commissions', {
        collaborator_id: collab.id,
        month:           form.month,
        azul_revenue:    form.azul_revenue,
        notes:           form.notes || null,
      });
      toast.success(`Comissão de ${collab.name} lançada com sucesso!`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  return (
    <ModalShell title={`Lançar Comissão — ${collab.name}`} subtitle={ROLE_LABEL[collab.role]} onClose={onClose}>
      <CommissionForm form={form} set={set} preview={preview} loadPrev={loadPrev} onPreview={loadPreview} />
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
  const isPaid = commission.status === 'paid';

  const [form, setForm] = useState({
    month:        commission.month,
    azul_revenue: parseFloat(commission.azul_revenue || 0),
    notes:        commission.notes || '',
  });
  const [preview,  setPreview]  = useState(null);
  const [loadPrev, setLoadPrev] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function loadPreview() {
    setLoadPrev(true);
    try {
      const res = await api.post('/internal-collaborators/commissions/preview', {
        collaborator_id: collab.id,
        azul_revenue:    form.azul_revenue,
      });
      setPreview(res.data);
    } catch { toast.error('Erro no preview'); }
    finally { setLoadPrev(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/internal-collaborators/commissions/${commission.id}`, {
        month:        form.month,
        azul_revenue: form.azul_revenue,
        notes:        form.notes || null,
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
      <CommissionForm form={form} set={set} preview={preview} loadPrev={loadPrev} onPreview={loadPreview} />
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
            <strong className="text-[#0C2D48]">{fmt(commission.total_amount)}</strong> será excluído permanentemente.
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

          <div className="bg-[#F3EEFF] border border-blue-200 rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Senha temporária</p>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono font-bold text-2xl text-[#0C2D48] tracking-widest select-all">
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
          <span className="text-base font-bold text-slate-900">📊 Regras de Comissão</span>
          <span className="text-xs text-slate-400 font-normal">(referência rápida)</span>
        </div>
        {open
          ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
          : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-5 space-y-4">
          <div>
            <p className="font-bold text-slate-900 mb-2">👔 PABLINE — Gerente Azul</p>
            <p className="text-sm text-slate-600">
              <strong className="text-[#0C2D48]">10% fixo</strong> sobre o total de comissão Azul recebida pela Movv no mês
              (o admin digita esse total diretamente — sem curva, sem fator de líquido).
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Salário base: <strong>R$ 1.621</strong> · somado sempre ao valor da comissão.
            </p>
          </div>

          <hr className="border-slate-200" />

          <div>
            <p className="font-bold text-slate-900 mb-2">💼 FERNANDO — Direta Certificação</p>
            <p className="text-sm text-slate-600">
              Fernando não usa mais este fluxo de lançamento manual. Vendas, metas, escalonamento de comissão
              e fechamento de folha ficam em <strong>Admin &gt; Direta Certificação</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
