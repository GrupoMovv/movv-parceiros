import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users, TrendingUp, DollarSign, CheckCircle2, Clock,
  Plus, X, RotateCcw, ChevronDown, ChevronUp, Loader2, Eye
} from 'lucide-react';

const fmt = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = v => (parseFloat(v || 0) * 100).toFixed(1) + '%';
const currentMonth = new Date().toISOString().slice(0, 7);

const ROLE_LABEL = {
  manager_azul:   'Gerente Azul',
  comercial_full: 'Comercial Azul + Direta',
};

export default function AdminInternalCommissions() {
  const [collaborators, setCollaborators]   = useState([]);
  const [commissions,   setCommissions]     = useState([]);
  const [loading,       setLoading]         = useState(true);
  const [modalCollab,   setModalCollab]     = useState(null); // collab obj
  const [expanded,      setExpanded]        = useState({});

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
      toast.success('Revertido para pendente.');
      load();
    } catch { toast.error('Erro ao reverter'); }
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

      {/* Resumo do mês */}
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
          onPaid={markPaid}
          onRevert={revert}
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
    </div>
  );
}

// ─── Card do colaborador ─────────────────────────────────────────────────────
function CollabCard({ collab, commissions, onLaunch, onPaid, onRevert, expanded, toggleExpand }) {
  const latest = commissions[0];
  return (
    <div className="card !p-0 overflow-hidden">
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

        <div className="flex items-center gap-2">
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
        <div className="px-6 pb-4 border-t border-slate-100 pt-4 bg-slate-50/50">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">Último lançamento — {latest.month}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-slate-400 text-xs">Fat. Azul</p>
              <p className="font-semibold text-slate-700">{fmt(latest.azul_revenue)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Comissão Azul</p>
              <p className="font-semibold text-slate-700">{fmt(latest.azul_commission)} <span className="text-xs font-normal text-slate-400">({fmtPct(latest.azul_commission_pct)})</span></p>
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
          <div className="mt-3 flex items-center gap-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${latest.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {latest.status === 'paid' ? '✓ Pago' : '⏳ Pendente'}
            </span>
            {latest.status === 'pending' && (
              <button onClick={() => onPaid(latest.id)}
                className="text-xs text-emerald-700 hover:text-emerald-800 border border-emerald-200 bg-emerald-50 px-3 py-1 rounded-lg transition-colors flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Marcar como pago
              </button>
            )}
            {latest.status === 'paid' && (
              <button onClick={() => onRevert(latest.id)}
                className="text-xs text-slate-600 hover:text-slate-800 border border-slate-200 bg-slate-50 px-3 py-1 rounded-lg transition-colors flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Reverter
              </button>
            )}
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
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {c.status === 'paid' ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.status === 'pending'
                        ? <button onClick={() => onPaid(c.id)} className="text-xs text-emerald-700 hover:underline flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Pagar</button>
                        : <button onClick={() => onRevert(c.id)} className="text-xs text-slate-500 hover:underline flex items-center gap-1"><RotateCcw className="w-3 h-3" />Reverter</button>
                      }
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

// ─── Modal de lançamento ──────────────────────────────────────────────────────
function LaunchModal({ collab, onClose, onSaved }) {
  const isPabline  = collab.role === 'manager_azul';
  const isFernando = collab.role === 'comercial_full';

  const [form, setForm] = useState({
    month:               currentMonth,
    azul_revenue:        '',
    base_via_accounting: '',
    base_via_direct:     '',
    cert_count:          '',
    notes:               '',
  });
  const [preview,  setPreview]  = useState(null);
  const [loadPrev, setLoadPrev] = useState(false);
  const [saving,   setSaving]   = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function loadPreview() {
    if (!form.azul_revenue && !form.base_via_accounting && !form.base_via_direct) return;
    setLoadPrev(true);
    try {
      const res = await api.post('/internal-collaborators/commissions/preview', {
        collaborator_id:    collab.id,
        azul_revenue:       parseFloat(form.azul_revenue)        || 0,
        base_via_accounting:parseFloat(form.base_via_accounting) || 0,
        base_via_direct:    parseFloat(form.base_via_direct)     || 0,
        cert_count:         parseInt(form.cert_count)            || 0,
      });
      setPreview(res.data);
    } catch { toast.error('Erro no preview'); }
    finally { setLoadPrev(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.post('/internal-collaborators/commissions', {
        collaborator_id:    collab.id,
        month:              form.month,
        azul_revenue:       parseFloat(form.azul_revenue)        || 0,
        base_via_accounting:parseFloat(form.base_via_accounting) || 0,
        base_via_direct:    parseFloat(form.base_via_direct)     || 0,
        cert_count:         parseInt(form.cert_count)            || 0,
        notes:              form.notes || null,
      });
      toast.success(`Comissão de ${collab.name} lançada com sucesso!`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Lançar Comissão — {collab.name}</h2>
            <p className="text-xs text-[#C9A84C] font-semibold mt-0.5">{ROLE_LABEL[collab.role]}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Mês */}
          <div>
            <label className="label">Mês de referência</label>
            <input type="month" className="input" value={form.month} onChange={e => set('month', e.target.value)} />
          </div>

          {/* Azul Revenue */}
          <div>
            <label className="label">Faturamento Bruto Azul (R$)</label>
            <input type="number" min="0" step="0.01" className="input"
              placeholder="Ex: 85000"
              value={form.azul_revenue}
              onChange={e => set('azul_revenue', e.target.value)} />
            <p className="text-xs text-slate-400 mt-1">
              Base de cálculo = {((parseFloat(form.azul_revenue) || 0) * 0.80).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (80% do bruto)
            </p>
          </div>

          {/* Curva informativa */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Curva de Comissão — {isPabline ? 'Pabline' : 'Fernando Azul'}
              </p>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(isPabline ? CURVA_PABLINE : CURVA_FERNANDO).map((tier, i) => {
                const net = (parseFloat(form.azul_revenue) || 0) * 0.80;
                const active = net >= tier.min && net <= tier.max;
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

          {/* Campos Direta — apenas Fernando */}
          {isFernando && (
            <div className="space-y-4">
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">
                  Direta Certificação <span className="text-xs font-normal text-slate-400">(Fernando recebe 25% sobre cada base)</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Base via Contabilidade (R$)</label>
                    <input type="number" min="0" step="0.01" className="input"
                      placeholder="venda − custo − com. cont."
                      value={form.base_via_accounting}
                      onChange={e => set('base_via_accounting', e.target.value)} />
                    <p className="text-xs text-emerald-600 mt-1 font-medium">
                      Fernando: {fmt((parseFloat(form.base_via_accounting) || 0) * 0.25)}
                    </p>
                  </div>
                  <div>
                    <label className="label">Base Venda Direta (R$)</label>
                    <input type="number" min="0" step="0.01" className="input"
                      placeholder="venda − custo"
                      value={form.base_via_direct}
                      onChange={e => set('base_via_direct', e.target.value)} />
                    <p className="text-xs text-emerald-600 mt-1 font-medium">
                      Fernando: {fmt((parseFloat(form.base_via_direct) || 0) * 0.25)}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label">Qtd. certificados emitidos (total)</label>
                  <input type="number" min="0" className="input w-40"
                    placeholder="0"
                    value={form.cert_count}
                    onChange={e => set('cert_count', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Regra do salário Fernando */}
          {isFernando && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
              <p className="font-semibold mb-1">Regra do Salário Fernando</p>
              <p>Se comissão total &lt; R$ 3.500 → salário R$ 1.621 é incluído</p>
              <p>Se comissão total ≥ R$ 3.500 → salário = R$ 0</p>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="label">Observações (opcional)</label>
            <textarea className="input min-h-[60px] resize-none" placeholder="Ex: Fechamento do mês X, bônus por meta atingida..."
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          {/* Preview */}
          <div className="border-t border-slate-100 pt-4">
            <button
              onClick={loadPreview}
              disabled={loadPrev}
              className="flex items-center gap-2 text-sm text-[#4A0E8F] border border-purple-200 bg-purple-50 px-4 py-2 rounded-xl hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              {loadPrev ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Calcular preview
            </button>

            {preview && (
              <div className="mt-4 bg-[#F8F4FF] border border-purple-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-[#4A0E8F] uppercase tracking-wider">Preview do Cálculo</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <PreviewItem label="Base líquida" value={fmt(preview.net_revenue)} />
                  <PreviewItem label="% Azul" value={fmtPct(preview.azul_commission_pct)} />
                  <PreviewItem label="Comissão Azul" value={fmt(preview.azul_commission)} />
                  {isFernando && <>
                    <PreviewItem label="Com. Direta" value={fmt(preview.direta_commission)} />
                  </>}
                  <PreviewItem label="Salário base" value={fmt(preview.base_salary)} />
                </div>
                <div className="border-t border-purple-200 pt-3 flex items-center justify-between">
                  <p className="text-slate-600 text-sm font-semibold">Total a receber</p>
                  <p className="text-[#4A0E8F] font-bold text-xl">{fmt(preview.total_amount)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar Lançamento
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CURVA_PABLINE = [
  { label: 'Até R$ 20k',       min: 0,      max: 20000,   pct: 0.03 },
  { label: 'R$ 20k – R$ 50k',  min: 20001,  max: 50000,   pct: 0.05 },
  { label: 'R$ 50k – R$ 100k', min: 50001,  max: 100000,  pct: 0.07 },
  { label: 'R$ 100k – R$ 200k',min: 100001, max: 200000,  pct: 0.06 },
  { label: 'R$ 200k – R$ 300k',min: 200001, max: 300000,  pct: 0.05 },
  { label: 'Acima R$ 300k',    min: 300001, max: Infinity, pct: 0.04 },
];

const CURVA_FERNANDO = [
  { label: 'Até R$ 50k',        min: 0,      max: 50000,   pct: 0.005 },
  { label: 'R$ 50k – R$ 100k',  min: 50001,  max: 100000,  pct: 0.010 },
  { label: 'Acima R$ 100k',     min: 100001, max: Infinity, pct: 0.015 },
];

function SummaryCard({ icon, label, value, bg, border, color }) {
  return (
    <div className={`rounded-2xl p-4 border ${bg} ${border} flex flex-col gap-1`}>
      <div className="flex items-center gap-2">{icon}<p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</p></div>
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
