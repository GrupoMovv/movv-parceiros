import { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import CardMetaProgress from '../../../components/direta/CardMetaProgress';
import { ShieldCheck, Loader2, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';

const fmt = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const currentMonth = new Date().toISOString().slice(0, 7);

export default function DiretaDashboard() {
  const [collab, setCollab]       = useState(null);
  const [goal, setGoal]           = useState(null);
  const [progresso, setProgresso] = useState(null);
  const [sales, setSales]         = useState([]);
  const [activities, setActivities] = useState([]);
  const [payrollStatus, setPayrollStatus] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing]     = useState(false);

  const load = useCallback(async () => {
    try {
      const collabsRes = await api.get('/internal-collaborators/collaborators');
      const fernando = collabsRes.data.find(c => c.role === 'comercial_full');
      if (!fernando) { toast.error('Colaborador Direta Certificação não encontrado'); return; }
      setCollab(fernando);

      const [goalRes, salesRes, actRes, commRes] = await Promise.all([
        api.get('/direta/goal', { params: { collaborator_id: fernando.id, reference_month: currentMonth } }),
        api.get('/direta/sales', { params: { collaborator_id: fernando.id, reference_month: currentMonth, status: 'confirmada' } }),
        api.get('/direta/activities', { params: { collaborator_id: fernando.id, reference_month: currentMonth } }),
        api.get('/internal-collaborators/commissions', { params: { collaborator_id: fernando.id, month: currentMonth } }),
      ]);
      setGoal(goalRes.data.goal);
      setProgresso(goalRes.data.progresso);
      setSales(salesRes.data);
      setActivities(actRes.data.slice(0, 8));
      setPayrollStatus(commRes.data[0]?.status || null);
    } catch {
      toast.error('Erro ao carregar dashboard Direta');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleClosePayroll() {
    setClosing(true);
    try {
      await api.post('/direta/payroll/close', { collaborator_id: collab.id, reference_month: currentMonth });
      toast.success('Folha do mês fechada com sucesso!');
      setConfirming(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao fechar folha');
    } finally { setClosing(false); }
  }

  if (loading) return (
    <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-[#0C2D48]" /></div>
  );

  const lucroTotal    = sales.reduce((s, v) => s + parseFloat(v.lucro), 0);
  const comissaoTotal = sales.reduce((s, v) => s + parseFloat(v.comissao_valor), 0);
  const viaAccounting = sales.filter(v => v.tipo_venda === 'contabilidade').length;
  const viaDirect     = sales.filter(v => v.tipo_venda === 'direta').length;
  const jaFechado     = payrollStatus === 'paid';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[#0C2D48]" />
          Direta Certificação — {collab?.name}
        </h1>
        <p className="text-slate-500 text-sm mt-1">Acompanhamento de vendas, metas e fechamento de folha.</p>
      </div>

      <CardMetaProgress goal={goal} progresso={progresso} />

      <div className="card">
        <h3 className="font-bold text-slate-900 mb-4">Prévia da Folha — {currentMonth}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-400 text-xs">Certificados</p>
            <p className="font-bold text-slate-900 text-lg">{sales.length}</p>
            <p className="text-slate-400 text-xs">{viaAccounting} contab. · {viaDirect} diretas</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Lucro total</p>
            <p className="font-bold text-slate-900 text-lg">{fmt(lucroTotal)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Comissão ({goal ? `${parseFloat(goal.comissao_pct)}%` : '—'})</p>
            <p className="font-bold text-[#0C2D48] text-lg">{fmt(comissaoTotal)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Status da folha</p>
            {jaFechado ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-sm mt-0.5">
                <CheckCircle2 className="w-4 h-4" /> Paga
              </span>
            ) : payrollStatus === 'pending' ? (
              <span className="text-amber-600 font-semibold text-sm mt-0.5">Fechada (pendente)</span>
            ) : (
              <span className="text-slate-400 text-sm mt-0.5">Ainda não fechada</span>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 mt-4 pt-4">
          {jaFechado ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Lock className="w-4 h-4" /> Este mês já foi pago. Estorne em Comissões Internas para refechar.
            </div>
          ) : !confirming ? (
            <button onClick={() => setConfirming(true)} className="btn-primary">
              Fechar Folha do Mês
            </button>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  Isso vai gravar {fmt(comissaoTotal)} de comissão (+ salário se aplicável) como lançamento
                  pendente em Comissões Internas para {currentMonth}. Confirma?
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirming(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleClosePayroll} disabled={closing} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {closing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmar Fechamento
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Atividades Recentes</h3>
        </div>
        {activities.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">Nenhuma atividade registrada este mês</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activities.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-slate-800 capitalize">{a.tipo}</span>
                  {a.contabilidade_name && <span className="text-slate-400"> · {a.contabilidade_name}</span>}
                  <p className="text-slate-500 text-xs mt-0.5">{a.observacoes}</p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap ml-3">{a.data_atividade?.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
