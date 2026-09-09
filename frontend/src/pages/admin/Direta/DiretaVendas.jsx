import { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import ModalEditarVenda from '../../../components/direta/ModalEditarVenda';
import { FileText, Loader2, XCircle, AlertTriangle, Pencil, Trash2, CheckCircle2 } from 'lucide-react';

const fmt = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const currentMonth = new Date().toISOString().slice(0, 7);
const STATUS_LABEL = { confirmada: 'Confirmada', cancelada: 'Cancelada', excluida: 'Excluída' };

export default function DiretaVendas() {
  const [sales, setSales]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ reference_month: currentMonth, tipo_venda: '', status: '' });
  const [modalEditar, setModalEditar] = useState(null);
  const [modalCancel, setModalCancel] = useState(null);
  const [canceling, setCanceling] = useState(false);
  const [modalExcluir, setModalExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

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

  async function handleExcluir() {
    if (!modalExcluir) return;
    setExcluindo(true);
    try {
      await api.delete(`/direta/sales/${modalExcluir.id}`);
      toast.success('Venda excluída.');
      setModalExcluir(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao excluir');
    } finally { setExcluindo(false); }
  }

  const confirmadas   = sales.filter(s => s.status === 'confirmada');
  const totalLucro    = confirmadas.reduce((s, v) => s + parseFloat(v.total_lucro_movv), 0);
  const totalComissao = confirmadas.reduce((s, v) => s + parseFloat(v.total_comissao_vendedor), 0);
  const vendasComToken = confirmadas.filter(s => s.incluiu_token).length;
  const receitaToken    = confirmadas.filter(s => s.incluiu_token).reduce((s, v) => s + parseFloat(v.valor_venda_token || 0), 0);
  const receitaCert     = confirmadas.reduce((s, v) => s + parseFloat(v.valor_venda_certificado || 0), 0);
  const pctComToken     = confirmadas.length ? Math.round((vendasComToken / confirmadas.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-[#0C2D48]" />
          Vendas — Movv Certificado
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

      <div className="card">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Breakdown por produto (confirmadas)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-slate-500 text-xs">Vendas de certificado</p>
            <p className="font-bold text-lg text-slate-800">{confirmadas.length} <span className="text-sm font-normal text-slate-400">({fmt(receitaCert)})</span></p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Vendas com token</p>
            <p className="font-bold text-lg text-slate-800">{vendasComToken} <span className="text-sm font-normal text-slate-400">({fmt(receitaToken)})</span></p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">% de vendas com token</p>
            <p className="font-bold text-lg text-slate-800">{pctComToken}%</p>
          </div>
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
              <option value="">Todos (exceto excluídas)</option>
              <option value="confirmada">Confirmada</option>
              <option value="cancelada">Cancelada</option>
              <option value="excluida">Excluída</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Data','Cliente','Tipo','Contabilidade','Cert','Token','Total Venda','Sua Comissão','Status','Ações'].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-10 text-slate-400">Carregando...</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-slate-400">Nenhuma venda encontrada</td></tr>
              ) : sales.map(s => (
                <tr key={s.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${s.status !== 'confirmada' ? 'opacity-50' : ''}`}>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-xs">{s.data_venda?.slice(0, 10)}</td>
                  <td className="py-3 px-4 text-slate-900 font-medium">{s.cliente_nome}</td>
                  <td className="py-3 px-4 text-slate-600 text-xs capitalize">{s.tipo_venda}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{s.contabilidade_name || '—'}</td>
                  <td className="py-3 px-4"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3 px-4">{s.incluiu_token ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <span className="text-slate-300 text-xs">—</span>}</td>
                  <td className="py-3 px-4 text-slate-700">{fmt(s.total_venda)}</td>
                  <td className="py-3 px-4 font-semibold text-[#0C2D48]">{fmt(s.total_comissao_vendedor)} <span className="text-xs text-slate-400 font-normal">({parseFloat(s.comissao_pct)}%)</span></td>
                  <td className="py-3 px-4">
                    <span className={s.status === 'confirmada' ? 'badge-approved' : 'badge-expired'}>
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      {s.status === 'confirmada' && (
                        <>
                          <button onClick={() => setModalEditar(s)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Editar venda">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setModalCancel(s)} className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Cancelar venda">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {s.status !== 'excluida' && (
                        <button onClick={() => setModalExcluir(s)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Excluir venda">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalEditar && (
        <ModalEditarVenda venda={modalEditar} onClose={() => setModalEditar(null)} onSaved={() => { setModalEditar(null); load(); }} />
      )}

      {modalExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5">
              <h2 className="font-bold text-slate-900 text-lg">Excluir Venda</h2>
              <p className="text-slate-600 text-sm mt-2">
                Excluir a venda de <strong>{modalExcluir.cliente_nome}</strong>? Use isso quando a venda foi cadastrada por engano — ela some da lista, mas fica registrada no histórico.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModalExcluir(null)} disabled={excluindo} className="btn-secondary">Voltar</button>
              <button
                onClick={handleExcluir}
                disabled={excluindo}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}

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
