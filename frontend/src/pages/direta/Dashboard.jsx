import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import CardMetaProgress from '../../components/direta/CardMetaProgress';
import ModalNovaVenda from '../../components/direta/ModalNovaVenda';
import ModalNovaAtividade from '../../components/direta/ModalNovaAtividade';
import { DollarSign, ShieldCheck, Loader2, Plus, ClipboardPlus } from 'lucide-react';

const fmt = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DiretaFernandoDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalVenda, setModalVenda] = useState(false);
  const [modalAtividade, setModalAtividade] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/direta/dashboard');
      setData(res.data);
    } catch { toast.error('Erro ao carregar seu painel'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-[#0C2D48]" /></div>
  );

  const { goal, folha, progresso, recent_sales, recent_activities } = data;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Olá, {user?.name} 👋</h1>
          <p className="text-slate-500 text-sm mt-1">Direta Certificação — suas vendas e metas do mês</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModalAtividade(true)} className="btn-secondary flex items-center gap-2">
            <ClipboardPlus className="w-4 h-4" /> Nova Atividade
          </button>
          <button onClick={() => setModalVenda(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nova Venda
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 bg-movv-gradient text-white border border-[#0C2D48] shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5" />
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">Comissão do mês</p>
          </div>
          <p className="font-bold text-2xl">{fmt(folha.direta_commission)}</p>
        </div>
        <div className="rounded-2xl p-5 bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-[#C9A84C]" />
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Certificados vendidos</p>
          </div>
          <p className="font-bold text-2xl text-slate-900">{folha.certificates_count}</p>
          <p className="text-xs text-slate-400 mt-1">{folha.via_accounting_count} contab. · {folha.via_direct_count} diretas</p>
        </div>
        <div className="rounded-2xl p-5 bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total estimado</p>
          </div>
          <p className="font-bold text-2xl text-slate-900">{fmt(folha.total_amount)}</p>
          {folha.base_salary > 0 && (
            <p className="text-xs text-slate-400 mt-1">Inclui salário base ({fmt(folha.base_salary)})</p>
          )}
        </div>
      </div>

      <CardMetaProgress goal={goal} progresso={progresso} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Vendas Recentes</h3>
          </div>
          {recent_sales.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">Nenhuma venda ainda</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent_sales.map(s => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{s.cliente_nome}</p>
                    <p className="text-slate-400 text-xs">{fmt(s.preco_venda)} · {s.data_venda?.slice(0, 10)}</p>
                  </div>
                  <span className={s.status === 'confirmada' ? 'badge-approved' : 'badge-expired'}>
                    {s.status === 'confirmada' ? 'OK' : 'Cancelada'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Atividades Recentes</h3>
          </div>
          {recent_activities.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">Nenhuma atividade ainda</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent_activities.map(a => (
                <div key={a.id} className="px-5 py-3 text-sm">
                  <p className="font-medium text-slate-800 capitalize">{a.tipo} {a.contato_nome && `— ${a.contato_nome}`}</p>
                  <p className="text-slate-400 text-xs truncate">{a.observacoes}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ModalNovaVenda open={modalVenda} onClose={() => setModalVenda(false)} onSaved={() => { setModalVenda(false); load(); }} />
      <ModalNovaAtividade open={modalAtividade} onClose={() => setModalAtividade(false)} onSaved={() => { setModalAtividade(false); load(); }} />
    </div>
  );
}
