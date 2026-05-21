import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  TrendingUp, ShieldCheck, DollarSign, Calendar, Award,
  Loader2, CheckCircle2, Clock, Zap
} from 'lucide-react';

const fmt = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = v => (parseFloat(v || 0) * 100).toFixed(1) + '%';

// Certificados Direta — referência para Fernando
const PF = [
  { produto: 'PF A1',              preco: 170, comissao: 47.22 },
  { produto: 'A3 1 Ano',           preco: 170, comissao: 47.22 },
  { produto: 'A3 2 Anos',          preco: 200, comissao: 55.56 },
  { produto: 'A3 + Cartão 1 Ano',  preco: 230, comissao: 63.89 },
  { produto: 'A3 + Cartão 2 Anos', preco: 260, comissao: 72.22 },
  { produto: 'A3 + Token 1 Ano',   preco: 240, comissao: 66.67 },
  { produto: 'A3 + Token 2 Anos',  preco: 280, comissao: 77.78 },
];
const PJ = [
  { produto: 'PJ A1',              preco: 180, comissao: 50.00 },
  { produto: 'A3 1 Ano',           preco: 180, comissao: 50.00 },
  { produto: 'A3 2 Anos',          preco: 220, comissao: 61.11 },
  { produto: 'A3 + Cartão 1 Ano',  preco: 240, comissao: 66.67 },
  { produto: 'A3 + Cartão 2 Anos', preco: 280, comissao: 77.78 },
  { produto: 'A3 + Token 1 Ano',   preco: 260, comissao: 72.22 },
  { produto: 'A3 + Token 2 Anos',  preco: 300, comissao: 83.33 },
];

const CURVA_PABLINE = [
  { label: 'Até R$ 50.000',           min: 0,      max: 50000,   pct: 0.05, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { label: 'R$ 50.001 – R$ 100.000',  min: 50001,  max: 100000,  pct: 0.07, color: 'bg-[#4A0E8F] text-white border-[#4A0E8F]' },
  { label: 'R$ 100.001 – R$ 200.000', min: 100001, max: 200000,  pct: 0.06, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { label: 'R$ 200.001 – R$ 300.000', min: 200001, max: 300000,  pct: 0.05, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { label: 'Acima de R$ 300.000',     min: 300001, max: Infinity, pct: 0.04, color: 'bg-slate-100 text-slate-600 border-slate-200' },
];

const CURVA_FERNANDO = [
  { label: 'Até R$ 50.000',           min: 0,      max: 50000,   pct: 0.005, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { label: 'R$ 50.001 – R$ 100.000',  min: 50001,  max: 100000,  pct: 0.010, color: 'bg-[#4A0E8F] text-white border-[#4A0E8F]' },
  { label: 'Acima de R$ 100.000',      min: 100001, max: Infinity,pct: 0.015, color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

export default function MinhasComissoes() {
  const { user } = useAuth();
  const isPabline  = user?.role === 'manager_azul';
  const isFernando = user?.role === 'comercial_full';

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
      <Loader2 className="w-8 h-8 animate-spin text-[#4A0E8F]" />
    </div>
  );

  const current = summary?.current_month;
  const net = current ? parseFloat(current.azul_revenue) * 0.80 : 0;
  const curva = isPabline ? CURVA_PABLINE : CURVA_FERNANDO;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Olá, {user?.name} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {isPabline ? 'Gerente Azul — acompanhe suas comissões mensais' : 'Comercial Azul + Direta — suas comissões e indicadores'}
        </p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isPabline && <>
          <StatCard
            icon={<DollarSign className="w-5 h-5 text-[#4A0E8F]" />}
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
        </>}

        {isFernando && <>
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-[#4A0E8F]" />}
            label="Comissão Azul este mês"
            value={fmt(current?.azul_commission)}
            sub={current ? <span className="text-xs text-slate-500">{fmtPct(current.azul_commission_pct)} sobre líquido</span> : <span className="text-xs text-slate-400">Aguardando lançamento</span>}
          />
          <StatCard
            icon={<ShieldCheck className="w-5 h-5 text-[#C9A84C]" />}
            label="Comissão Direta este mês"
            value={fmt(current?.direta_commission)}
            sub={current ? <span className="text-xs text-slate-500">{current.direta_certificates_count} certificados</span> : <span className="text-xs text-slate-400">Aguardando lançamento</span>}
          />
          <StatCard
            icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
            label="Total a receber este mês"
            value={fmt(current?.total_amount)}
            sub={current ? <StatusBadge status={current.status} /> : <span className="text-xs text-slate-400">Aguardando lançamento</span>}
            highlight
          />
        </>}
      </div>

      {/* Box informativo Pabline */}
      {isPabline && (
        <div className="bg-[#F3EEFF] border border-purple-200 rounded-2xl p-5">
          <p className="text-[#4A0E8F] font-semibold text-sm">Sobre sua comissão</p>
          <p className="text-slate-600 text-sm mt-1">
            Você ganha sobre <strong>todas as vendas da Azul</strong> — próprias, da equipe e de parceiros externos.
            Quanto mais a Azul fatura, maior é a sua faixa na curva.
          </p>
        </div>
      )}

      {/* Box motivacional Fernando */}
      {isFernando && (
        <div className="bg-[#FDF8ED] border border-[#C9A84C]/30 rounded-2xl p-5 flex items-start gap-3">
          <Zap className="w-5 h-5 text-[#C9A84C] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[#C9A84C] font-semibold text-sm">Vendas diretas pagam até 2x mais!</p>
            <p className="text-slate-600 text-sm mt-1">
              Na venda direta de certificados, você retém mais margem. Incentive os clientes a fechar direto com você.
            </p>
          </div>
        </div>
      )}

      {/* Card da curva — Pabline */}
      {isPabline && (
        <div className="card !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-[#4A0E8F]" />
            <h3 className="font-bold text-slate-900">Sua Tabela de Comissão</h3>
            <span className="text-xs text-slate-400 ml-auto">base = 80% do faturamento Azul</span>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CURVA_PABLINE.map((tier, i) => {
              const active = net >= tier.min && net <= tier.max && !!current;
              return (
                <div key={i} className={`rounded-xl border px-4 py-3 flex items-center justify-between transition-all ${active ? 'bg-movv-gradient text-white border-[#4A0E8F] shadow-lg' : `border ${tier.color}`}`}>
                  <span className={`text-sm ${active ? 'text-white font-semibold' : ''}`}>{tier.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-lg ${active ? 'text-[#C9A84C]' : ''}`}>{(tier.pct * 100).toFixed(0)}%</span>
                    {active && <span className="text-[10px] bg-[#C9A84C] text-[#4A0E8F] font-bold px-2 py-0.5 rounded-full">ATUAL</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
            A faixa é determinada pelo lucro líquido do mês (80% do faturamento bruto Azul). A alíquota se aplica sobre toda a base, não é progressiva.
          </div>
        </div>
      )}

      {/* Tabelas Direta — Fernando */}
      {isFernando && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#C9A84C]" />
            <h3 className="font-bold text-slate-900">Sua Tabela Azul</h3>
          </div>
          <div className="card !p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h4 className="font-semibold text-slate-900 text-sm">Curva Comissão Azul</h4>
              <p className="text-xs text-slate-400 mt-0.5">base = 80% do faturamento Azul das suas vendas</p>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {CURVA_FERNANDO.map((tier, i) => {
                const active = net >= tier.min && net <= tier.max && !!current;
                return (
                  <div key={i} className={`rounded-xl border px-4 py-3 flex items-center justify-between ${active ? 'bg-movv-gradient text-white border-[#4A0E8F] shadow-lg' : `border ${tier.color}`}`}>
                    <span className={`text-sm ${active ? 'text-white font-semibold' : ''}`}>{tier.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-lg ${active ? 'text-[#C9A84C]' : ''}`}>{(tier.pct * 100).toFixed(1)}%</span>
                      {active && <span className="text-[10px] bg-[#C9A84C] text-[#4A0E8F] font-bold px-2 py-0.5 rounded-full">ATUAL</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabela Direta */}
          <div className="flex items-center gap-2 mt-2">
            <ShieldCheck className="w-5 h-5 text-[#C9A84C]" />
            <h3 className="font-bold text-slate-900">Sua Tabela Direta — 14 Certificados</h3>
          </div>
          {[{ titulo: 'Pessoa Física (PF)', dados: PF }, { titulo: 'Pessoa Jurídica (PJ)', dados: PJ }].map(({ titulo, dados }) => (
            <div key={titulo} className="card !p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h4 className="font-semibold text-slate-900 text-sm">{titulo}</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Produto</th>
                      <th className="text-right px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Preço cliente</th>
                      <th className="text-right px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Com. contabilidade</th>
                      <th className="text-right px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Sua com. via cont.</th>
                      <th className="text-right px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Sua com. direta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">{row.produto}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{fmt(row.preco)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{fmt(row.comissao)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-emerald-600 font-semibold text-xs">25% da base</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-[#C9A84C] font-bold text-xs">25% da base</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
            <p className="font-semibold">Como é calculado?</p>
            <p className="mt-1">Via contabilidade: 25% sobre (preço − custo Direta − comissão contabilidade)</p>
            <p className="mt-0.5">Venda direta: 25% sobre (preço − custo Direta)</p>
            <p className="mt-1 text-amber-600">O admin lança os valores base mensalmente e o sistema aplica os 25% automaticamente.</p>
          </div>
        </div>
      )}

      {/* Histórico */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#4A0E8F]" />
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
                  {isFernando && <th className="text-right px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">Com. Direta</th>}
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
                    {isFernando && <td className="px-4 py-3 text-right text-[#C9A84C] font-medium">{fmt(c.direta_commission)}</td>}
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(c.base_salary)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#4A0E8F]">{fmt(c.total_amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Simulador de Comissão */}
      {isPabline && <SimuladorPabline />}
      {isFernando && <SimuladorFernando />}
    </div>
  );
}

function StatCard({ icon, label, value, sub, highlight }) {
  return (
    <div className={`rounded-2xl p-5 border ${highlight ? 'bg-movv-gradient text-white border-[#4A0E8F] shadow-lg' : 'bg-white border-slate-200 shadow-sm'}`}>
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

// ─── Simulador helpers ─────────────────────────────────────────────────────────
const SALARIO_BASE = 1621;
const COM_CONT_PER_CERT   = 13.51;
const COM_DIRETA_PER_CERT = 29.43;

function getTierSim(curve, value) {
  return [...curve].reverse().find(t => value >= t.min) || curve[0];
}

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

function IntegerInputSim({ value, onChange, placeholder }) {
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
      className="input"
      value={display}
      onChange={handleChange}
      placeholder={placeholder || '0'}
    />
  );
}

// ─── Simulador Pabline ─────────────────────────────────────────────────────────
function SimuladorPabline() {
  const [faturamento, setFaturamento] = useState(0);

  const ll       = faturamento * 0.80;
  const tier     = faturamento > 0 ? getTierSim(CURVA_PABLINE, ll) : null;
  const comissao = tier ? ll * tier.pct : 0;
  const total    = comissao + SALARIO_BASE;

  return (
    <div className="card !p-0 overflow-hidden border border-purple-200 shadow-lg">
      <div className="bg-movv-gradient px-5 py-4">
        <h3 className="font-bold text-white text-lg">🧮 Simule seus ganhos</h3>
        <p className="text-white/70 text-sm mt-0.5">Veja quanto você pode ganhar com diferentes faturamentos</p>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label className="label">Faturamento mensal da Azul:</label>
          <CurrencyInputSim value={faturamento} onChange={setFaturamento} placeholder="Ex: 50.000,00" />
        </div>

        {tier ? (
          <div className="bg-[#F3EEFF] border border-purple-200 rounded-2xl p-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Faixa aplicada:</span>
              <span className="font-bold text-[#4A0E8F]">{(tier.pct * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Lucro líquido Azul:</span>
              <span className="font-semibold text-slate-800">{fmt(ll)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Sua comissão:</span>
              <span className="font-semibold text-[#4A0E8F]">{fmt(comissao)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">+ Salário base:</span>
              <span className="font-semibold text-slate-700">{fmt(SALARIO_BASE)}</span>
            </div>
            <div className="border-t border-purple-200 pt-2.5 flex justify-between items-center">
              <span className="font-bold text-slate-900 text-sm">TOTAL ESTIMADO:</span>
              <span className="font-bold text-xl text-[#C9A84C]">{fmt(total)}</span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-slate-400 text-sm">
            Digite um faturamento para ver a simulação
          </div>
        )}

        <p className="text-xs text-slate-400 italic">
          Esta é apenas uma simulação. Os valores reais são definidos no fechamento mensal.
        </p>
      </div>
    </div>
  );
}

// ─── Simulador Fernando ────────────────────────────────────────────────────────
function SimuladorFernando() {
  const [vendasAzul, setVendasAzul] = useState(0);
  const [certCont,   setCertCont]   = useState(0);
  const [certDireta, setCertDireta] = useState(0);

  const llAzul        = vendasAzul * 0.80;
  const tierAzul      = vendasAzul > 0 ? getTierSim(CURVA_FERNANDO, llAzul) : null;
  const comAzul       = tierAzul ? llAzul * tierAzul.pct : 0;
  const comCont       = certCont * COM_CONT_PER_CERT;
  const comDireta     = certDireta * COM_DIRETA_PER_CERT;
  const subtotalDireta = comCont + comDireta;
  const totalComissoes = comAzul + subtotalDireta;
  const showSalario   = totalComissoes < 3500;
  const totalEstimado = totalComissoes + (showSalario ? SALARIO_BASE : 0);
  const hasInput      = vendasAzul > 0 || certCont > 0 || certDireta > 0;

  return (
    <div className="card !p-0 overflow-hidden border border-[#C9A84C]/30 shadow-lg">
      <div className="bg-movv-gradient px-5 py-4">
        <h3 className="font-bold text-white text-lg">🧮 Simule seus ganhos</h3>
        <p className="text-white/70 text-sm mt-0.5">Preencha os campos abaixo para ver sua comissão total</p>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label className="label">Vendas Azul (suas vendas) no mês:</label>
          <CurrencyInputSim value={vendasAzul} onChange={setVendasAzul} placeholder="Ex: 15.000,00" />
        </div>
        <div>
          <label className="label">Certificados Direta vendidos via contabilidade:</label>
          <IntegerInputSim value={certCont} onChange={setCertCont} placeholder="Ex: 60" />
        </div>
        <div>
          <label className="label">Certificados Direta — venda direta (cliente próprio):</label>
          <IntegerInputSim value={certDireta} onChange={setCertDireta} placeholder="Ex: 40" />
        </div>

        {hasInput ? (
          <div className="bg-[#F3EEFF] border border-purple-200 rounded-2xl p-4 space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comissão Azul</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">% aplicada: {tierAzul ? (tierAzul.pct * 100).toFixed(1) : '0,0'}%</span>
                <span className="font-semibold text-[#4A0E8F]">{fmt(comAzul)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comissão Direta</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Via contabilidade ({certCont} cert):</span>
                <span className="font-semibold text-slate-700">{fmt(comCont)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Venda direta ({certDireta} cert):</span>
                <span className="font-semibold text-slate-700">{fmt(comDireta)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-purple-100 pt-1.5">
                <span className="text-slate-600 font-medium">Subtotal Direta:</span>
                <span className="font-semibold text-slate-800">{fmt(subtotalDireta)}</span>
              </div>
            </div>

            <div className="border-t border-purple-200 pt-2.5 space-y-1.5">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-slate-900">TOTAL COMISSÕES:</span>
                <span className="text-[#4A0E8F]">{fmt(totalComissoes)}</span>
              </div>
              {showSalario && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">+ Salário base:</span>
                    <span className="font-semibold text-slate-700">{fmt(SALARIO_BASE)}</span>
                  </div>
                  <p className="text-xs text-slate-400">(porque comissão &lt; R$ 3.500)</p>
                </>
              )}
              <div className="flex justify-between items-center border-t border-purple-200 pt-2">
                <span className="font-bold text-slate-900 text-sm">TOTAL ESTIMADO:</span>
                <span className="font-bold text-xl text-[#C9A84C]">{fmt(totalEstimado)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-slate-400 text-sm">
            Preencha os campos acima para ver a simulação
          </div>
        )}

        <p className="text-xs text-slate-400 italic">
          Esta é apenas uma simulação. Os valores reais são definidos no fechamento mensal.
        </p>
      </div>
    </div>
  );
}
