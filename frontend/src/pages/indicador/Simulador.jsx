import { useState } from 'react';
import { TrendingUp } from 'lucide-react';

const PCT = { alta: 0.01, media: 0.007, baixa: 0.002 };

function formatBRL(v) {
  return parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function IndicadorSimulador() {
  const [qtd, setQtd] = useState(5);
  const [valor, setValor] = useState(10000);
  const [cat, setCat] = useState('alta');

  const result = qtd * valor * PCT[cat];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#0C2D48]/10 rounded-xl flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-[#0C2D48]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Simulador de Ganhos</h1>
          <p className="text-slate-500 text-sm">Calcule quanto você pode ganhar por mês</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="label">Indicações por mês</label>
            <input
              type="number"
              min="1"
              value={qtd}
              onChange={e => setQtd(Math.max(0, Number(e.target.value)))}
              className="input text-xl font-semibold"
            />
          </div>
          <div>
            <label className="label">Valor médio por operação (R$)</label>
            <input
              type="number"
              min="0"
              step="100"
              value={valor}
              onChange={e => setValor(Math.max(0, Number(e.target.value)))}
              className="input text-xl font-semibold"
            />
          </div>
          <div>
            <label className="label">Categoria predominante</label>
            <select
              value={cat}
              onChange={e => setCat(e.target.value)}
              className="input text-lg font-semibold"
            >
              <option value="alta">Alta — 1%</option>
              <option value="media">Média — 0,7%</option>
              <option value="baixa">Baixa — 0,2%</option>
            </select>
          </div>
        </div>

        {/* Result */}
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#2d1b5e] rounded-2xl p-8 text-center">
          <p className="text-white/60 text-sm uppercase tracking-wider font-semibold mb-3">Estimativa de ganhos mensais</p>
          <p className="text-6xl font-black text-[#C9A84C]">{formatBRL(result)}</p>
          <p className="text-white/40 text-xs mt-4">
            {qtd} indicações × {formatBRL(valor)} × {(PCT[cat] * 100).toFixed(1)}%
          </p>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: 'Por indicação', value: formatBRL(valor * PCT[cat]) },
            { label: 'Por semana (est.)', value: formatBRL(result / 4) },
            { label: 'Por ano (est.)', value: formatBRL(result * 12) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className="font-bold text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        <p className="text-slate-400 text-xs text-center">
          * Estimativa meramente informativa. Os valores reais dependem das operações efetivadas.
        </p>
      </div>
    </div>
  );
}
