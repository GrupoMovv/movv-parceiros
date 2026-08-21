import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { DollarSign, TrendingUp, Loader2, CheckCircle2, Lock } from 'lucide-react';

const fmt = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SindicatoMinhaComissao() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/sindicato/me');
      setData(res.data);
    } catch { toast.error('Erro ao carregar seu bônus'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-[#0C2D48]" />
    </div>
  );

  const { salario_fixo, current_month, history } = data;
  const totalAtual = current_month
    ? parseFloat(current_month.bonus_renan) + parseFloat(salario_fixo)
    : parseFloat(salario_fixo);

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Olá, {user?.name} 👋</h1>
        <p className="text-slate-500 text-sm mt-1">Sindicato — acompanhe seu salário e bônus mensal</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 bg-movv-gradient text-white border border-[#0C2D48] shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5" />
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">Total do mês</p>
          </div>
          <p className="font-bold text-2xl">{fmt(totalAtual)}</p>
          <div className="mt-1">
            {current_month
              ? <StatusBadge status={current_month.status} />
              : <span className="text-white/60 text-xs">Aguardando fechamento</span>}
          </div>
        </div>
        <div className="rounded-2xl p-5 bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-[#C9A84C]" />
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Salário fixo</p>
          </div>
          <p className="font-bold text-2xl text-slate-900">{fmt(salario_fixo)}</p>
        </div>
        <div className="rounded-2xl p-5 bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Bônus deste mês</p>
          </div>
          <p className="font-bold text-2xl text-slate-900">{fmt(current_month?.bonus_renan || 0)}</p>
        </div>
      </div>

      <div className="bg-[#F3EEFF] border border-blue-200 rounded-2xl p-5">
        <p className="text-[#0C2D48] font-semibold text-sm">Sobre seu bônus</p>
        <p className="text-slate-600 text-sm mt-1">
          Todo mês você recebe <strong>{fmt(salario_fixo)} de salário fixo</strong> + um bônus variável
          conforme o faturamento bruto do Sindicato:
        </p>
        <table className="w-full mt-3 text-sm">
          <tbody>
            <tr className="text-slate-500"><td className="py-1">Menor que R$ 130.000</td><td className="py-1 text-right font-semibold">R$ 0</td></tr>
            <tr className="text-slate-500"><td className="py-1">R$ 130.000 – R$ 139.999</td><td className="py-1 text-right font-semibold">R$ 300</td></tr>
            <tr className="text-slate-500"><td className="py-1">R$ 140.000 – R$ 149.999</td><td className="py-1 text-right font-semibold">R$ 400</td></tr>
            <tr className="text-slate-500"><td className="py-1">R$ 150.000 – R$ 159.999</td><td className="py-1 text-right font-semibold">R$ 500</td></tr>
            <tr className="text-slate-500"><td className="py-1">R$ 160.000 ou mais</td><td className="py-1 text-right font-semibold">R$ 600</td></tr>
          </tbody>
        </table>
        <p className="text-slate-400 text-xs mt-2">
          O bônus só aparece aqui depois que o mês é fechado pelo administrador.
        </p>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#0C2D48]" />
          <h3 className="font-bold text-slate-900">Histórico Mensal</h3>
        </div>
        {history.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">Nenhum mês fechado ainda</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Mês</th>
                  <th className="text-right px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Bônus</th>
                  <th className="text-right px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Salário</th>
                  <th className="text-right px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Total</th>
                  <th className="px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={h.id} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                    <td className="px-4 py-3 font-mono text-xs text-[#C9A84C] font-semibold">{h.reference_month}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(h.bonus_renan)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(salario_fixo)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#0C2D48]">{fmt(parseFloat(h.bonus_renan) + parseFloat(salario_fixo))}</td>
                    <td className="px-4 py-3"><StatusBadge status={h.status} /></td>
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

function StatusBadge({ status }) {
  if (status === 'pago') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
      <CheckCircle2 className="w-3 h-3" /> Pago
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-[#0C2D48]">
      <Lock className="w-3 h-3" /> Fechado
    </span>
  );
}
