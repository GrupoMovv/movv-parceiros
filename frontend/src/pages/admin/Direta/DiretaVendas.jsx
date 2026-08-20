import { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { FileText, Loader2, XCircle, AlertTriangle } from 'lucide-react';

const fmt = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const currentMonth = new Date().toISOString().slice(0, 7);

export default function DiretaVendas() {
  const [sales, setSales]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ reference_month: currentMonth, tipo_venda: '', status: '' });
  const [modalCancel, setModalCancel] = useState(null);
  const [canceling, setCanceling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.reference_month) params.reference_month = filters.reference_month;
      if (filters.tipo_venda) params.tipo_venda = filters.tipo_venda;
      if (filters.status) params.status = filters.status;
      const res = await api.get('/direta/sales', { params });
      setSales(res.data);
    } catch { toast.error('Erro ao carregar vendas'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel() {
    if (!modalCancel) return;
    setCanceling(true);
    try {
      await api.patch(`/direta/sales/${modalCancel.id}/cancel`);
      toast.success('Venda cancelada.');
      setModalCancel(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao cancelar');
    } finally { setCanceling(false); }
  }

  const totalLucro    = sales.filter(s => s.status === 'confirmada').reduce((s, v) => s + parseFloat(v.lucro), 0);
  const totalComissao = sales.filter(s => s.status === 'confirmada').reduce((s, v) => s + parseFloat(v.comissao_valor), 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-[#0C2D48]" />
          Vendas — Direta Certificação
        </h1>
        <p className="text-slate-500 text-sm mt-1">{sales.length} vendas no filtro atual</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl p-4 border bg-blue-50 border-blue-200">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Lucro total (confirmadas)</p>
          <p className="font-bold text-xl text-[#0C2D48]">{fmt(totalLucro)}</p>
        </div>
        <div className="rounded-2xl p-4 border bg-emerald-50 border-emerald-200">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Comissão total (confirmadas)</p>
          <p className="font-bold text-xl text-emerald-700">{fmt(totalComissao)}</p>
        </div>
      </div>

      <div className="card py-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Mês</label>
            <input type="month" className="input" value={filters.reference_month}
              onChange={e => setFilters(f => ({ ...f, reference_month: e.target.value }))} />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={filters.tipo_venda} onChange={e => setFilters(f => ({ ...f, tipo_venda: e.target.value }))}>
              <option value="">Todos</option>
              <option value="contabilidade">Via contabilidade</option>
              <option value="direta">Venda direta</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">Todos</option>
              <option value="confirmada">Confirmada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Data','Cliente','Tipo','Contabilidade','Preço','Lucro','Comissão','Status','Ações'].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">Carregando...</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">Nenhuma venda encontrada</td></tr>
              ) : sales.map(s => (
                <tr key={s.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${s.status === 'cancelada' ? 'opacity-50' : ''}`}>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-xs">{s.data_venda?.slice(0, 10)}</td>
                  <td className="py-3 px-4 text-slate-900 font-medium">{s.cliente_nome}</td>
                  <td className="py-3 px-4 text-slate-600 text-xs capitalize">{s.tipo_venda}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{s.contabilidade_name || '—'}</td>
                  <td className="py-3 px-4 text-slate-700">{fmt(s.preco_venda)}</td>
                  <td className="py-3 px-4 text-slate-700">{fmt(s.lucro)}</td>
                  <td className="py-3 px-4 font-semibold text-[#0C2D48]">{fmt(s.comissao_valor)} <span className="text-xs text-slate-400 font-normal">({parseFloat(s.comissao_pct)}%)</span></td>
                  <td className="py-3 px-4">
                    <span className={s.status === 'confirmada' ? 'badge-approved' : 'badge-expired'}>
                      {s.status === 'confirmada' ? 'Confirmada' : 'Cancelada'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {s.status === 'confirmada' && (
                      <button onClick={() => setModalCancel(s)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Cancelar venda">
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">Cancelar Venda</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{modalCancel.cliente_nome}</p>
                </div>
              </div>
              <p className="text-slate-600 text-sm mt-4">
                Esta venda deixará de contar na folha do mês. Vendas já contabilizadas em outras não serão recalculadas.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModalCancel(null)} disabled={canceling} className="btn-secondary">Voltar</button>
              <button
                onClick={handleCancel}
                disabled={canceling}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                {canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Sim, cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
