import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CreditCard, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import Modal from '../../components/ui/Modal';

function buildMonthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({ value: d.toISOString().slice(0, 7), label: format(d, 'MMMM yyyy', { locale: ptBR }) });
  }
  return opts;
}

export default function AdminPayments() {
  const [pending, setPending] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ reference_month: '', payment_date: '', receipt: null });
  const [saving, setSaving] = useState(false);
  const months = buildMonthOptions();

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [pend, pays] = await Promise.all([
        api.get('/payments/pending'),
        api.get('/payments'),
      ]);
      setPending(pend.data);
      setPayments(pays.data);
    } catch { toast.error('Erro ao carregar pagamentos'); }
    finally { setLoading(false); }
  }

  function openPay(partner) {
    setSelected(partner);
    setForm({
      reference_month: new Date().toISOString().slice(0, 7),
      payment_date: new Date().toISOString().slice(0, 10),
      receipt: null,
    });
    setModal(true);
  }

  async function handlePay() {
    if (!form.reference_month) { toast.error('Informe o mês de referência'); return; }
    setSaving(true);
    try {
      const data = new FormData();
      data.append('partner_id', selected.id);
      data.append('amount', selected.pending_total);
      data.append('reference_month', form.reference_month);
      data.append('payment_date', form.payment_date);
      data.append('commission_ids', JSON.stringify(selected.commission_ids));
      if (form.receipt) data.append('receipt', form.receipt);

      await api.post('/payments', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`PIX de R$ ${parseFloat(selected.pending_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} registrado!`);
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao registrar pagamento');
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pagamentos PIX</h1>
        <p className="text-slate-500 text-sm mt-1">Gerencie os pagamentos de comissões — todo dia 5 do mês</p>
      </div>

      {/* Next payment alert */}
      <div className="flex items-start gap-3 bg-[#FDF8ED] border border-[#C9A84C]/30 rounded-2xl p-4">
        <Calendar className="w-5 h-5 text-[#C9A84C] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-slate-800 font-medium text-sm">Próximo pagamento: dia 5</p>
          <p className="text-slate-500 text-xs mt-0.5">
            {pending.length} parceiro(s) com saldo aprovado · Total: R$ {pending.reduce((a, b) => a + parseFloat(b.pending_total), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Pending payments */}
      {pending.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" /> Aguardando Pagamento
          </h3>
          <div className="space-y-3">
            {pending.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div>
                  <p className="text-slate-900 font-medium">{p.name}</p>
                  <p className="text-[#C9A84C] font-mono text-xs">{p.code}</p>
                  <p className="text-slate-500 text-xs mt-0.5">PIX: {p.pix_key || 'não cadastrado'}</p>
                  <p className="text-slate-400 text-xs">{p.commission_count} comissão(ões) aprovada(s)</p>
                </div>
                <div className="text-right">
                  <p className="text-[#1B5E20] font-bold text-xl">
                    R$ {parseFloat(p.pending_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <button onClick={() => openPay(p)} className="btn-primary mt-2 text-sm flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" /> Registrar PIX
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="card">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#1B5E20]" /> Histórico de Pagamentos
        </h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-movv-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <p className="text-center text-slate-400 py-8">Nenhum pagamento registrado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Data','Parceiro','Código','Chave PIX','Mês Ref.','Valor','Comprovante'].map(h => (
                    <th key={h} className="text-left text-slate-500 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(pay => (
                  <tr key={pay.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4 text-slate-500 whitespace-nowrap text-xs">
                      {format(new Date(pay.payment_date), 'dd/MM/yyyy')}
                    </td>
                    <td className="py-3 pr-4 text-slate-900 whitespace-nowrap">{pay.partner_name}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-[#C9A84C]">{pay.partner_code}</td>
                    <td className="py-3 pr-4 text-slate-500 text-xs">{pay.pix_key || '—'}</td>
                    <td className="py-3 pr-4 text-slate-600 capitalize text-xs">
                      {format(new Date(pay.reference_month + '-02'), 'MMM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="py-3 pr-4 text-[#1B5E20] font-bold whitespace-nowrap">
                      R$ {parseFloat(pay.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3">
                      {pay.pix_receipt ? (
                        <a
                          href={`/uploads/${pay.pix_receipt}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-movv-900 hover:text-movv-800 text-xs underline"
                        >
                          Ver comprovante
                        </a>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Registrar Pagamento PIX">
        {selected && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-slate-900 font-semibold">{selected.name}</p>
              <p className="text-[#C9A84C] font-mono text-sm mt-0.5">{selected.code}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-slate-500 text-sm">Chave PIX:</span>
                <span className="text-slate-900 text-sm font-medium">{selected.pix_key || 'Não cadastrada'}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-500 text-sm">Valor a pagar:</span>
                <span className="text-[#1B5E20] font-bold text-lg">
                  R$ {parseFloat(selected.pending_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div>
              <label className="label">Mês de referência</label>
              <select className="input appearance-none" value={form.reference_month} onChange={e => setForm(f => ({ ...f, reference_month: e.target.value }))}>
                {months.map(m => <option key={m.value} value={m.value} className="capitalize">{m.label}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Data do pagamento</label>
              <input type="date" className="input" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
            </div>

            <div>
              <label className="label">Comprovante PIX (opcional)</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={e => setForm(f => ({ ...f, receipt: e.target.files[0] }))}
                className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-movv-900 file:text-white hover:file:bg-movv-800 cursor-pointer"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handlePay} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving
                  ? <span className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                  : <><CreditCard className="w-4 h-4" /> Confirmar PIX</>
                }
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
