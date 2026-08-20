import { Target, TrendingUp, Users, Phone } from 'lucide-react';

const fmtPct = v => parseFloat(v || 0).toFixed(1).replace(/\.0$/, '') + '%';

function Bar({ label, icon: Icon, atual, meta, color }) {
  const pct = meta > 0 ? Math.min(100, (atual / meta) * 100) : 0;
  const bateu = atual >= meta;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <Icon className="w-3.5 h-3.5" />
          <span>{label}</span>
        </div>
        <span className={`text-sm font-semibold ${bateu ? 'text-emerald-600' : 'text-slate-700'}`}>
          {atual} / {meta}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${bateu ? 'bg-emerald-500' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Progresso de metas do mês (certificados/visitas/contatos) + comissão vigente.
export default function CardMetaProgress({ goal, progresso }) {
  if (!goal) return null;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-[#0C2D48]" />
          <h3 className="font-bold text-slate-900">Meta do Mês — {goal.reference_month}</h3>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-[#C9A84C]/20 text-[#0C2D48]">
          <TrendingUp className="w-3 h-3" /> {fmtPct(goal.comissao_pct)} de comissão
        </span>
      </div>

      <div className="space-y-3">
        <Bar
          label="Certificados vendidos"
          icon={Target}
          atual={progresso?.certificados || 0}
          meta={goal.meta_certificados}
          color="bg-[#0C2D48]"
        />
        <Bar
          label="Visitas (indicador secundário)"
          icon={Users}
          atual={progresso?.visitas || 0}
          meta={goal.meta_visitas}
          color="bg-blue-400"
        />
        <Bar
          label="Contatos (indicador secundário)"
          icon={Phone}
          atual={progresso?.contatos || 0}
          meta={goal.meta_contatos}
          color="bg-indigo-400"
        />
      </div>

      <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
        Bater a meta de certificados neste mês sobe sua comissão para o próximo degrau no mês seguinte.
        Visitas e contatos são apenas acompanhados — não bloqueiam nem alteram a comissão.
      </p>
    </div>
  );
}
