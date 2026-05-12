import { useEffect, useState } from 'react';
import api from '../services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, TrendingUp, Filter, ChevronDown, Info } from 'lucide-react';

const TYPE_LABELS = {
  employee:        'Funcionário (51%)',
  accounting:      'Contabilidade (49%)',
  accounting_full: 'Cert. Digital (100%)',
  bpo_first:       'BPO 1º Mês',
  bpo_recurring:   'BPO Recorrente',
};

const STATUS_MAP = {
  pending:  { label: 'Pendente',  cls: 'badge-pending' },
  approved: { label: 'Aprovado',  cls: 'badge-approved' },
  paid:     { label: 'Pago',      cls: 'badge-paid' },
};

function buildMonthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: d.toISOString().slice(0, 7),
      label: format(d, 'MMMM yyyy', { locale: ptBR }),
    });
  }
  return opts;
}

export default function Statement() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('');
  const months = buildMonthOptions();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/commissions/statement' + (month ? `?month_filter=${month}` : '')),
      api.get('/commissions/summary'),
    ]).then(([s, sum]) => {
      const filtered = month ? s.data.filter(i => i.reference_month === month) : s.data;
      setItems(filtered);
      setSummary(sum.data);
    }).finally(() => setLoading(false));
  }, [month]);

  const totalPending  = items.filter(i => i.status === 'pending').reduce((a, b) => a + parseFloat(b.amount), 0);
  const totalApproved = items.filter(i => i.status === 'approved').reduce((a, b) => a + parseFloat(b.amount), 0);
  const totalPaid     = items.filter(i => i.status === 'paid').reduce((a, b) => a + parseFloat(b.amount), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Extrato de Comissões</h1>
        <p className="text-slate-500 text-sm mt-1">Histórico completo por mês e por produto</p>
      </div>

      {/* Info banner novo modelo */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-blue-700 text-sm">
          <strong>Modelo de comissão:</strong> Funcionário recebe <strong>51%</strong> · Contabilidade recebe <strong>49%</strong> (34% líquido + 15% imposto). A contabilidade recebe o total via PIX e é responsável pela distribuição ao funcionário e pelo pagamento dos tributos.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Pendente" value={totalPending}  color="text-amber-600"      bg="bg-amber-50"    border="border-amber-200" />
        <SummaryCard label="Aprovado" value={totalApproved} color="text-movv-900"        bg="bg-purple-50"   border="border-purple-200" />
        <SummaryCard label="Pago"     value={totalPaid}     color="text-[#1B5E20]"       bg="bg-emerald-50"  border="border-emerald-200" />
      </div>

      {/* Month summary table */}
      {summary.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#C9A84C]" /> Resumo por Mês
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-slate-500 font-medium pb-2">Mês</th>
                  <th className="text-right text-slate-500 font-medium pb-2">Pendente</th>
                  <th className="text-right text-slate-500 font-medium pb-2">Aprovado</th>
                  <th className="text-right text-slate-500 font-medium pb-2">Pago</th>
                  <th className="text-right text-slate-500 font-medium pb-2">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  summary.reduce((acc, row) => {
                    if (!acc[row.reference_month]) acc[row.reference_month] = { pending: 0, approved: 0, paid: 0, count: 0 };
                    acc[row.reference_month][row.status] = parseFloat(row.total);
                    acc[row.reference_month].count += parseInt(row.count);
                    return acc;
                  }, {})
                ).map(([m, data]) => (
                  <tr key={m} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 text-slate-900 font-medium capitalize">
                      {format(new Date(m + '-02'), 'MMMM yyyy', { locale: ptBR })}
                    </td>
                    <td className="py-3 text-right text-amber-600">
                      {data.pending > 0 ? `R$ ${data.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="py-3 text-right text-movv-900">
                      {data.approved > 0 ? `R$ ${data.approved.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="py-3 text-right text-[#1B5E20] font-medium">
                      {data.paid > 0 ? `R$ ${data.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="py-3 text-right text-slate-500">{data.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed statement */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C9A84C]" /> Detalhes
          </h3>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="input pl-9 pr-8 appearance-none w-48 text-sm"
            >
              <option value="">Todos os meses</option>
              {months.map(m => (
                <option key={m.value} value={m.value} className="capitalize">{m.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-2 border-movv-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhuma comissão encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Data','Protocolo','Cliente','Produto','Tipo','Valor Op.','Comissão','Status'].map(h => (
                    <th key={h} className="text-left text-slate-500 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4 text-slate-500 whitespace-nowrap text-xs">
                      {format(new Date(item.created_at), 'dd/MM/yyyy')}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-[#C9A84C] whitespace-nowrap">{item.protocol}</td>
                    <td className="py-3 pr-4 text-slate-900 whitespace-nowrap">{item.client_name}</td>
                    <td className="py-3 pr-4 text-slate-600 whitespace-nowrap">{item.product_name}</td>
                    <td className="py-3 pr-4 text-slate-500 text-xs whitespace-nowrap">{TYPE_LABELS[item.type] || item.type}</td>
                    <td className="py-3 pr-4 text-slate-600 whitespace-nowrap">
                      {item.operated_value ? `R$ ${parseFloat(item.operated_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="py-3 pr-4 text-gradient font-bold whitespace-nowrap">
                      R$ {parseFloat(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3">
                      <span className={STATUS_MAP[item.status]?.cls}>{STATUS_MAP[item.status]?.label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={6} className="pt-3 text-slate-500 text-xs font-medium">
                    {items.length} registro(s)
                  </td>
                  <td className="pt-3 text-gradient font-bold text-base">
                    R$ {items.reduce((a, b) => a + parseFloat(b.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, bg, border }) {
  return (
    <div className={`rounded-2xl p-5 border ${bg} ${border}`}>
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>
        R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}
