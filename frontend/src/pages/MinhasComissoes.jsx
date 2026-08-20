import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  TrendingUp, DollarSign, Calendar, Award,
  Loader2, CheckCircle2, Clock
} from 'lucide-react';

const fmt = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = v => (parseFloat(v || 0) * 100).toFixed(1) + '%';

export default function MinhasComissoes() {
  const { user } = useAuth();
  const isFernando = user?.role === 'comercial_full';
  if (isFernando) return <Navigate to="/direta/dashboard" replace />;

  const [summary,      setSummary]      = useState(null);
  const [commissions,  setCommissions]  = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [summRes, histRes] = await Promise.all([
          api.get('/internal-collaborators/me/summary'),
          api.get('/internal-collaborators/me/commissions'),
        ]);
        setSummary(summRes.data);
        setCommissions(histRes.data);
      } catch { toast.error('Erro ao carregar dados'); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-[#0C2D48]" />
    </div>
  );

  const current = summary?.current_month;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Olá, {user?.name} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Gerente Azul — acompanhe suas comissões mensais
        </p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<DollarSign className="w-5 h-5 text-[#0C2D48]" />}
          label="Você ganhou este mês"
          value={fmt(current?.total_amount)}
          sub={current ? <StatusBadge status={current.status} /> : <span className="text-slate-400 text-xs">Aguardando lançamento</span>}
          highlight
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          label="Acumulado 12 meses"
          value={fmt(summary?.total_12m)}
          sub={<span className="text-xs text-slate-400">{summary?.months_count || 0} meses lançados</span>}
        />
        <StatCard
          icon={<Calendar className="w-5 h-5 text-[#C9A84C]" />}
          label="Próximo pagamento"
          value="Dia 15"
          sub={<span className="text-xs text-slate-400">do mês seguinte</span>}
        />
      </div>

      {/* Box informativo Pabline */}
      <div className="bg-[#F3EEFF] border border-blue-200 rounded-2xl p-5">
        <p className="text-[#0C2D48] font-semibold text-sm">Sobre sua comissão</p>
        <p className="text-slate-600 text-sm mt-1">
          Você recebe <strong>10% fixo</strong> sobre o total de comissão Azul recebida pela Movv no mês
          (o admin lança esse total diretamente todo mês).
        </p>
      </div>

      {/* Card — Pabline (10% fixo) */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Award className="w-5 h-5 text-[#0C2D48]" />
          <h3 className="font-bold text-slate-900">Sua Comissão</h3>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider">Comissão Azul recebida (100%)</p>
            <p className="font-bold text-slate-900 text-lg mt-1">{fmt(current?.azul_revenue)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider">Sua alíquota</p>
            <p className="font-bold text-[#0C2D48] text-lg mt-1">10% fixo</p>
          </div>
        </div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
          Sua comissão é sempre 10% do valor lançado pelo admin — sem faixas ou curvas.
        </div>
      </div>

      {/* Histórico */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#0C2D48]" />
          <h3 className="font-bold text-slate-900">Histórico Mensal</h3>
        </div>
        {commissions.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">Nenhum lançamento ainda</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Mês</th>
                  <th className="text-right px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Fat. Azul</th>
                  <th className="text-right px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">% Azul</th>
                  <th className="text-right px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Com. Azul</th>
                  <th className="text-right px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Salário</th>
                  <th className="text-right px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Total</th>
                  <th className="px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c, i) => (
                  <tr key={c.id} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                    <td className="px-4 py-3 font-mono text-xs text-[#C9A84C] font-semibold">{c.month}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(c.azul_revenue)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmtPct(c.azul_commission_pct)}</td>
                    <td className="px-4 py-3 text-right text-slate-700 font-medium">{fmt(c.azul_commission)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(c.base_salary)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#0C2D48]">{fmt(c.total_amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Simulador de Comissão */}
      <SimuladorPabline />
    </div>
  );
}

function StatCard({ icon, label, value, sub, highlight }) {
  return (
    <div className={`rounded-2xl p-5 border ${highlight ? 'bg-movv-gradient text-white border-[#0C2D48] shadow-lg' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <p className={`text-xs font-medium uppercase tracking-wider ${highlight ? 'text-white/70' : 'text-slate-400'}`}>{label}</p>
      </div>
      <p className={`font-bold text-2xl ${highlight ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      <div className="mt-1">{sub}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'paid') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
      <CheckCircle2 className="w-3 h-3" /> Pago
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
      <Clock className="w-3 h-3" /> Pendente
    </span>
  );
}

// ─── Simulador Pabline (10% fixo) ───────────────────────────────────────────
const SALARIO_BASE = 1621;

function CurrencyInputSim({ value, onChange, placeholder }) {
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
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none select-none">R$</span>
      <input
        type="text"
        inputMode="numeric"
        className="input pl-9"
        value={display}
        onChange={handleChange}
        placeholder={placeholder || '0,00'}
      />
    </div>
  );
}

function SimuladorPabline() {
  const [comissaoAzul, setComissaoAzul] = useState(0);

  const comissao = comissaoAzul * 0.10;
  const total     = comissao + SALARIO_BASE;

  return (
    <div className="card !p-0 overflow-hidden border border-blue-200 shadow-lg">
      <div className="bg-movv-gradient px-5 py-4">
        <h3 className="font-bold text-white text-lg">🧮 Simule seus ganhos</h3>
        <p className="text-white/70 text-sm mt-0.5">Veja quanto você pode ganhar com diferentes totais de comissão Azul</p>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label className="label">Comissão Azul recebida pela Movv no mês:</label>
          <CurrencyInputSim value={comissaoAzul} onChange={setComissaoAzul} placeholder="Ex: 50.000,00" />
        </div>

        {comissaoAzul > 0 ? (
          <div className="bg-[#F3EEFF] border border-blue-200 rounded-2xl p-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Sua alíquota:</span>
              <span className="font-bold text-[#0C2D48]">10% fixo</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Sua comissão:</span>
              <span className="font-semibold text-[#0C2D48]">{fmt(comissao)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">+ Salário base:</span>
              <span className="font-semibold text-slate-700">{fmt(SALARIO_BASE)}</span>
            </div>
            <div className="border-t border-blue-200 pt-2.5 flex justify-between items-center">
              <span className="font-bold text-slate-900 text-sm">TOTAL ESTIMADO:</span>
              <span className="font-bold text-xl text-[#C9A84C]">{fmt(total)}</span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-slate-400 text-sm">
            Digite um valor para ver a simulação
          </div>
        )}

        <p className="text-xs text-slate-400 italic">
          Esta é apenas uma simulação. Os valores reais são definidos no fechamento mensal.
        </p>
      </div>
    </div>
  );
}
