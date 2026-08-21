import { useEffect, useState, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import CurrencyInput from '../../../components/ui/CurrencyInput';
import {
  Users, Plus, X, Loader2, Lock, Unlock, CheckCircle2, RotateCcw,
  Trash2, AlertTriangle, ChevronDown, ChevronUp, Clock,
} from 'lucide-react';

const fmt = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const currentMonth = new Date().toISOString().slice(0, 7);

const SALARIO_FIXO_RENAN = 1000.00;
const FAIXAS_BONUS_RENAN = [
  { minimo: 130000, maximo: 140000, bonus: 300 },
  { minimo: 140000, maximo: 150000, bonus: 400 },
  { minimo: 150000, maximo: 160000, bonus: 500 },
  { minimo: 160000, maximo: Infinity, bonus: 600 },
];

function calcularBonus(faturamentoBruto) {
  const f = parseFloat(faturamentoBruto) || 0;
  if (f < FAIXAS_BONUS_RENAN[0].minimo) return 0;
  const faixa = FAIXAS_BONUS_RENAN.find(fx => f >= fx.minimo && f < fx.maximo);
  return faixa ? faixa.bonus : 0;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SindicatoFaturamento() {
  const [faturamentos, setFaturamentos] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modalLaunch,  setModalLaunch]  = useState(null); // null | 'new' | row (editar)
  const [modalDelete,  setModalDelete]  = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/sindicato/faturamentos');
      setFaturamentos(res.data);
    } catch { toast.error('Erro ao carregar faturamentos'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleClose(id) {
    try {
      await api.patch(`/sindicato/faturamentos/${id}/close`);
      toast.success('Mês fechado! Renan já pode ver o bônus.');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Erro ao fechar mês'); }
  }

  async function handleReopen(id) {
    try {
      await api.patch(`/sindicato/faturamentos/${id}/reopen`);
      toast.success('Mês reaberto para edição.');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Erro ao reabrir mês'); }
  }

  async function handleMarkPaid(id) {
    try {
      await api.patch(`/sindicato/faturamentos/${id}/paid`);
      toast.success('Marcado como pago!');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Erro ao marcar como pago'); }
  }

  async function handleRevert(id) {
    try {
      await api.patch(`/sindicato/faturamentos/${id}/revert`);
      toast.success('Pagamento estornado.');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Erro ao estornar'); }
  }

  async function handleDelete() {
    if (!modalDelete) return;
    try {
      await api.delete(`/sindicato/faturamentos/${modalDelete.id}`);
      toast.success('Lançamento excluído.');
      setModalDelete(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Erro ao excluir'); }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#0C2D48]" />
            Sindicato — Renan
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Lance o faturamento bruto mensal do Sindicato — o bônus do Renan é calculado automaticamente.
          </p>
        </div>
        <button onClick={() => setModalLaunch('new')} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Lançar Faturamento
        </button>
      </div>

      <TabelaFaixas />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#0C2D48]" />
        </div>
      ) : faturamentos.length === 0 ? (
        <div className="card text-center py-12 text-slate-400 text-sm">
          Nenhum faturamento lançado ainda
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Mês', 'Faturamento Bruto', 'Bônus Renan', 'Salário', 'Total', 'Status', 'Ações'].map(h => (
                    <th key={h} className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {faturamentos.map(f => (
                  <tr key={f.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-xs text-[#C9A84C] font-semibold">{f.reference_month}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(f.faturamento_bruto)}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{fmt(f.bonus_renan)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(SALARIO_FIXO_RENAN)}</td>
                    <td className="px-4 py-3 font-bold text-[#0C2D48]">{fmt(parseFloat(f.bonus_renan) + SALARIO_FIXO_RENAN)}</td>
                    <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                    <td className="px-4 py-3">
                      <RowActions
                        f={f}
                        onEdit={() => setModalLaunch(f)}
                        onClose={() => handleClose(f.id)}
                        onReopen={() => handleReopen(f.id)}
                        onMarkPaid={() => handleMarkPaid(f.id)}
                        onRevert={() => handleRevert(f.id)}
                        onDelete={() => setModalDelete(f)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalLaunch && (
        <LaunchModal
          existing={modalLaunch === 'new' ? null : modalLaunch}
          onClose={() => setModalLaunch(null)}
          onSaved={() => { setModalLaunch(null); load(); }}
        />
      )}

      {modalDelete && (
        <DeleteModal
          f={modalDelete}
          onClose={() => setModalDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'pago') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
      <CheckCircle2 className="w-3 h-3" /> Pago
    </span>
  );
  if (status === 'fechado') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-[#0C2D48]">
      <Lock className="w-3 h-3" /> Fechado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
      <Clock className="w-3 h-3" /> Aberto
    </span>
  );
}

// ─── Row actions ──────────────────────────────────────────────────────────────
function RowActions({ f, onEdit, onClose, onReopen, onMarkPaid, onRevert, onDelete }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {f.status === 'aberto' && (
        <>
          <button onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-[#0C2D48] hover:bg-blue-100 transition-colors">
            Editar
          </button>
          <button onClick={onClose} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors">
            <Lock className="w-3 h-3" /> Fechar
          </button>
          <button onClick={onDelete} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </>
      )}
      {f.status === 'fechado' && (
        <>
          <button onClick={onMarkPaid} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
            <CheckCircle2 className="w-3 h-3" /> Pagar
          </button>
          <button onClick={onReopen} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors">
            <Unlock className="w-3 h-3" /> Reabrir
          </button>
        </>
      )}
      {f.status === 'pago' && (
        <button onClick={onRevert} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors">
          <RotateCcw className="w-3 h-3" /> Estornar
        </button>
      )}
    </div>
  );
}

// ─── Launch/Edit Modal ────────────────────────────────────────────────────────
function LaunchModal({ existing, onClose, onSaved }) {
  const [month, setMonth] = useState(existing?.reference_month || currentMonth);
  const [faturamento, setFaturamento] = useState(parseFloat(existing?.faturamento_bruto || 0));
  const [saving, setSaving] = useState(false);

  const bonus = calcularBonus(faturamento);
  const total = bonus + SALARIO_FIXO_RENAN;

  async function handleSave() {
    setSaving(true);
    try {
      await api.post('/sindicato/faturamentos', {
        reference_month: month,
        faturamento_bruto: faturamento,
      });
      toast.success('Faturamento lançado com sucesso!');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{existing ? 'Editar' : 'Lançar'} Faturamento</h2>
            <p className="text-xs text-[#C9A84C] font-semibold mt-0.5">Sindicato — Renan</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="label">Mês de referência</label>
            <input
              type="month"
              className="input"
              value={month}
              onChange={e => setMonth(e.target.value)}
              disabled={!!existing}
            />
          </div>

          <div>
            <label className="label">Faturamento Bruto do Sindicato no Mês</label>
            <CurrencyInput value={faturamento} onChange={setFaturamento} placeholder="130.000,00" />
          </div>

          <div className="bg-[#F8F4FF] border border-blue-200 rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-semibold text-[#0C2D48] uppercase tracking-wider">Prévia do Cálculo</p>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Bônus (faixa do faturamento):</span>
              <span className="font-semibold text-[#0C2D48]">{fmt(bonus)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">+ Salário fixo:</span>
              <span className="font-semibold text-slate-700">{fmt(SALARIO_FIXO_RENAN)}</span>
            </div>
            <div className="border-t border-blue-200 pt-2.5 flex justify-between items-center">
              <span className="font-bold text-slate-900 text-sm">TOTAL DO MÊS:</span>
              <span className="font-bold text-xl text-[#C9A84C]">{fmt(total)}</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !month}
            className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function DeleteModal({ f, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Excluir Lançamento</h2>
              <p className="text-xs text-slate-500 mt-0.5">{f.reference_month}</p>
            </div>
          </div>
          <p className="text-slate-600 text-sm mt-4 leading-relaxed">
            Tem certeza? Esta ação <strong>não pode ser desfeita</strong>.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Sim, excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tabela de Faixas (colapsável) ─────────────────────────────────────────────
function TabelaFaixas() {
  const [open, setOpen] = useState(false);

  return (
    <div className="card !p-0 overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-slate-900">📊 Faixas de Bônus</span>
          <span className="text-xs text-slate-400 font-normal">(referência rápida)</span>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-5 space-y-2 text-sm">
          <p className="text-slate-600">Salário fixo: <strong className="text-[#0C2D48]">{fmt(SALARIO_FIXO_RENAN)}</strong> · somado sempre ao bônus da faixa.</p>
          <table className="w-full mt-2">
            <tbody>
              <tr className="text-slate-500"><td className="py-1">Menor que R$ 130.000</td><td className="py-1 text-right font-semibold">R$ 0 (só salário)</td></tr>
              <tr className="text-slate-500"><td className="py-1">R$ 130.000 – R$ 139.999</td><td className="py-1 text-right font-semibold">R$ 300</td></tr>
              <tr className="text-slate-500"><td className="py-1">R$ 140.000 – R$ 149.999</td><td className="py-1 text-right font-semibold">R$ 400</td></tr>
              <tr className="text-slate-500"><td className="py-1">R$ 150.000 – R$ 159.999</td><td className="py-1 text-right font-semibold">R$ 500</td></tr>
              <tr className="text-slate-500"><td className="py-1">R$ 160.000 ou mais</td><td className="py-1 text-right font-semibold">R$ 600 (teto)</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
