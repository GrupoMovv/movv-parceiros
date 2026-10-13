import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardList, Search, CheckCircle2, Filter, Pencil } from 'lucide-react';
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
  const [dados, setDados] = useState(null); // indicação com CPF/contrato em edição

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let data = referrals;
    if (statusFilter) data = data.filter(r => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        r.client_name.toLowerCase().includes(q) ||
        r.protocol.toLowerCase().includes(q) ||
        r.partner_code?.toLowerCase().includes(q) ||
        (r.numero_contrato || '').includes(q) ||
        (r.client_cpf || '').includes(q.replace(/\D/g, '') || '§')
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
                  <td className="py-3 px-4 text-slate-900 whitespace-nowrap">
                    {r.client_name}
                    {(r.client_cpf || r.numero_contrato) && (
                      <p className="text-[11px] text-slate-400 font-mono">
                        {r.client_cpf ? `CPF ${r.client_cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')}` : ''}
                        {r.client_cpf && r.numero_contrato ? ' · ' : ''}
                        {r.numero_contrato ? `contrato ${r.numero_contrato}` : ''}
                      </p>
                    )}
                  </td>
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
                  <td className="py-3 px-4 space-y-1">
                    <button onClick={() => setDados({ id: r.id, client_name: r.client_name, client_cpf: r.client_cpf || '', numero_contrato: r.numero_contrato || '' })}
                      className="flex items-center gap-1 text-xs text-slate-600 border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded-lg">
                      <Pencil className="w-3 h-3" /> CPF / contrato
                    </button>
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

      {/* CPF e contrato da indicação (o contrato só existe depois que a Azul
          digita a proposta; também entra sozinho pela importação da Azul) */}
      <Modal open={Boolean(dados)} onClose={() => setDados(null)} title="CPF e contrato da indicação">
        {dados && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{dados.client_name}</p>
            <div>
              <label className="label">CPF do cliente</label>
              <input className="input" inputMode="numeric" value={dados.client_cpf}
                onChange={e => setDados(d => ({ ...d, client_cpf: e.target.value.replace(/[^\d.-]/g, '').slice(0, 14) }))} placeholder="000.000.000-00" />
            </div>
            <div>
              <label className="label">Número do contrato na Azul</label>
              <input className="input font-mono" inputMode="numeric" value={dados.numero_contrato}
                onChange={e => setDados(d => ({ ...d, numero_contrato: e.target.value.replace(/\D/g, '') }))} placeholder="Só depois que a Azul digitar a proposta" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDados(null)} className="btn-secondary flex-1">Cancelar</button>
              <button disabled={saving} className="btn-primary flex-1" onClick={async () => {
                setSaving(true);
                try {
                  await api.patch(`/referrals/${dados.id}/dados`, { client_cpf: dados.client_cpf.replace(/\D/g, ''), numero_contrato: dados.numero_contrato });
                  toast.success('Indicação atualizada');
                  setDados(null);
                  load();
                } catch (err) {
                  toast.error(err.response?.data?.error || 'Erro ao salvar');
                } finally { setSaving(false); }
              }}>Salvar</button>
            </div>
          </div>
        )}
      </Modal>

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
                commissionRate={parseFloat(selected.percentual_repasse) || 0.01}
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

function CommissionPreviewBox({ value, productType, commissionRate, bpoMonth }) {
  const fmt = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const pct = (commissionRate * 100).toFixed(1);

  if (productType === 'digital_certificate') {
    const total = value * commissionRate;
    return (
      <div className="bg-[#FDF8ED] border border-[#C9A84C]/30 rounded-xl p-3 space-y-1.5">
        <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-wider">Comissões a gerar</p>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Contabilidade ({pct}%)</span>
          <span className="text-gradient font-bold">R$ {fmt(total)}</span>
        </div>
      </div>
    );
  }

  if (productType === 'bpo') {
    const amount = bpoMonth === 1 ? 650 : 70;
    return (
      <div className="bg-[#FDF8ED] border border-[#C9A84C]/30 rounded-xl p-3 space-y-1.5">
        <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-wider">Comissões a gerar</p>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Parceiro ({bpoMonth === 1 ? '1º mês' : 'Recorrente'})</span>
          <span className="text-gradient font-bold">R$ {fmt(amount)}</span>
        </div>
      </div>
    );
  }

  const total       = value * commissionRate;
  const funcionario = total * 0.51;
  const contab      = total * 0.34;
  const imposto     = total * 0.15;

  return (
    <div className="bg-[#FDF8ED] border border-[#C9A84C]/30 rounded-xl p-3 space-y-1.5">
      <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-wider">Comissões a gerar — {pct}% do valor</p>
      <div className="flex justify-between text-sm">
        <span className="text-slate-600">Funcionário (51%)</span>
        <span className="text-[#1B5E20] font-bold">R$ {fmt(funcionario)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-600">Contabilidade (34%)</span>
        <span className="text-[#1B5E20] font-bold">R$ {fmt(contab)}</span>
      </div>
      <div className="flex justify-between text-sm border-t border-[#C9A84C]/20 pt-1.5 mt-0.5">
        <span className="text-slate-400 text-xs italic">Imposto (15%) — retido pela contabilidade</span>
        <span className="text-slate-400 text-xs font-medium">R$ {fmt(imposto)}</span>
      </div>
      <div className="flex justify-between text-sm border-t border-[#C9A84C]/30 pt-1.5 font-semibold">
        <span className="text-slate-700">Total (100%)</span>
        <span className="text-gradient font-bold">R$ {fmt(total)}</span>
      </div>
    </div>
  );
}
