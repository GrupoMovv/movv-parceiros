import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardList, Search, CheckCircle2, Filter } from 'lucide-react';
import Modal from '../../components/ui/Modal';

const STATUS_MAP = {
  pending:   { label: 'Pendente',   cls: 'badge-pending' },
  converted: { label: 'Convertida', cls: 'badge-converted' },
  expired:   { label: 'Expirada',   cls: 'badge-expired' },
  cancelled: { label: 'Cancelada',  cls: 'badge-expired' },
};

export default function AdminReferrals() {
  const [referrals, setReferrals] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ operated_value: '', bpo_month_count: 1 });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let data = referrals;
    if (statusFilter) data = data.filter(r => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        r.client_name.toLowerCase().includes(q) ||
        r.protocol.toLowerCase().includes(q) ||
        r.partner_code?.toLowerCase().includes(q)
      );
    }
    setFiltered(data);
  }, [search, statusFilter, referrals]);

  async function load() {
    try {
      const r = await api.get('/referrals');
      setReferrals(r.data);
    } catch { toast.error('Erro ao carregar indicações'); }
    finally { setLoading(false); }
  }

  function openConfirm(r) {
    setSelected(r);
    setForm({ operated_value: '', bpo_month_count: 1 });
    setModal(true);
  }

  async function handleConfirm() {
    if (!form.operated_value || parseFloat(form.operated_value) <= 0) {
      toast.error('Informe o valor operado');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/referrals/${selected.id}/confirm`, {
        operated_value: parseFloat(form.operated_value),
        bpo_month_count: parseInt(form.bpo_month_count),
      });
      toast.success('Venda confirmada! Comissões calculadas.');
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao confirmar');
    } finally { setSaving(false); }
  }

  const isBpo = selected?.product_type === 'bpo';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Indicações</h1>
        <p className="text-slate-500 text-sm mt-1">{referrals.length} indicações no total</p>
      </div>

      {/* Filters */}
      <div className="card py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar protocolo, cliente, parceiro..." className="input pl-10" />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input pl-9 appearance-none w-44">
              <option value="">Todos os status</option>
              <option value="pending">Pendente</option>
              <option value="converted">Convertida</option>
              <option value="expired">Expirada</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {['pending','converted','expired','cancelled'].map(s => {
          const count = referrals.filter(r => r.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={`rounded-xl p-3 border text-left transition-all ${
                statusFilter === s
                  ? 'border-[#C9A84C]/50 bg-[#FDF8ED]'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <p className="text-slate-500 text-xs uppercase tracking-wide">{STATUS_MAP[s]?.label}</p>
              <p className="text-slate-900 font-bold text-xl mt-1">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Protocolo','Cliente','WhatsApp','Produto','Parceiro','Valor Op.','Validade','Status','Ação'].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">Nenhuma indicação encontrada</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs text-[#C9A84C] whitespace-nowrap">{r.protocol}</td>
                  <td className="py-3 px-4 text-slate-900 whitespace-nowrap">{r.client_name}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{r.client_whatsapp}</td>
                  <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{r.product_name}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{r.partner_code}</td>
                  <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                    {r.operated_value ? `R$ ${parseFloat(r.operated_value).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">
                    {format(new Date(r.expires_at), 'dd/MM/yy')}
                  </td>
                  <td className="py-3 px-4">
                    <span className={STATUS_MAP[r.status]?.cls}>{STATUS_MAP[r.status]?.label}</span>
                  </td>
                  <td className="py-3 px-4">
                    {r.status === 'pending' && (
                      <button onClick={() => openConfirm(r)} className="flex items-center gap-1 text-xs text-[#1B5E20] hover:text-emerald-700 border border-emerald-200 hover:border-emerald-300 bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors">
                        <CheckCircle2 className="w-3 h-3" /> Confirmar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Sale Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Confirmar Venda">
        {selected && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-sm">
              <Row label="Protocolo"  value={selected.protocol} mono />
              <Row label="Cliente"    value={selected.client_name} />
              <Row label="Produto"    value={selected.product_name} />
              <Row label="Parceiro"   value={selected.partner_code} mono />
            </div>

            <div>
              <label className="label">Valor operado (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.operated_value}
                onChange={e => setForm(f => ({ ...f, operated_value: e.target.value }))}
                placeholder="Ex: 50000.00"
              />
            </div>

            {isBpo && (
              <div>
                <label className="label">Mês do BPO (1 = primeiro mês)</label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={form.bpo_month_count}
                  onChange={e => setForm(f => ({ ...f, bpo_month_count: e.target.value }))}
                />
                <p className="text-slate-400 text-xs mt-1">
                  1º mês = 50% (R$699,50) · 2º mês+ = 5% recorrente (R$69,95)
                </p>
              </div>
            )}

            {form.operated_value && parseFloat(form.operated_value) > 0 && (
              <CommissionPreviewBox
                value={parseFloat(form.operated_value)}
                productType={selected.product_type}
                bpoMonth={parseInt(form.bpo_month_count)}
              />
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleConfirm} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Salvando...' : 'Confirmar Venda'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`text-slate-900 ${mono ? 'font-mono text-[#C9A84C]' : ''}`}>{value}</span>
    </div>
  );
}

function CommissionPreviewBox({ value, productType, bpoMonth }) {
  let lines = [];
  if (productType === 'digital_certificate') {
    lines = [{ label: 'Contabilidade (100%)', amount: value * 0.01 }];
  } else if (productType === 'bpo') {
    const rate = bpoMonth === 1 ? 0.50 : 0.05;
    lines = [{ label: `Parceiro (${bpoMonth === 1 ? '50%' : '5%'})`, amount: 1399 * rate }];
  } else {
    const total = value * 0.01;
    lines = [
      { label: 'Funcionário (60%)', amount: total * 0.60 },
      { label: 'Contabilidade (40%)', amount: total * 0.40 },
    ];
  }
  return (
    <div className="bg-[#FDF8ED] border border-[#C9A84C]/30 rounded-xl p-3 space-y-1.5">
      <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-wider">Comissões a gerar</p>
      {lines.map(l => (
        <div key={l.label} className="flex justify-between text-sm">
          <span className="text-slate-600">{l.label}</span>
          <span className="text-gradient font-bold">R$ {l.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      ))}
    </div>
  );
}
