import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { UserPlus, CheckCircle } from 'lucide-react';

function maskCPF(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

function validCPF(cpf) {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(c[10]);
}

function formatBRL(v) {
  return parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function IndicadorIndicar() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    client_name: '', client_cpf: '', client_whatsapp: '', client_email: '',
    product_name: '', estimated_value: '', notes: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get('/indicators/products').then(res => setProducts(res.data)).catch(() => {});
  }, []);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
  }

  const selectedProduct = products.find(p => p.name === form.product_name);
  const estimatedCommission = selectedProduct && form.estimated_value
    ? parseFloat(form.estimated_value) * selectedProduct.pct
    : null;

  function validate() {
    const e = {};
    if (!form.client_name.trim()) e.client_name = 'Nome obrigatório';
    const rawCpf = form.client_cpf.replace(/\D/g, '');
    if (!rawCpf) e.client_cpf = 'CPF obrigatório';
    else if (!validCPF(rawCpf)) e.client_cpf = 'CPF inválido';
    if (!form.client_whatsapp) e.client_whatsapp = 'WhatsApp obrigatório';
    if (!form.product_name) e.product_name = 'Selecione um produto';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await api.post('/indicators/referrals', {
        ...form,
        client_cpf: form.client_cpf.replace(/\D/g, ''),
        client_whatsapp: form.client_whatsapp.replace(/\D/g, ''),
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : undefined,
        product_category: selectedProduct?.category,
      });
      setSuccess(true);
      toast.success('Indicação registrada com sucesso!');
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao registrar indicação';
      if (err.response?.status === 409) {
        toast.error(msg);
        setErrors({ client_cpf: msg });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Indicação registrada!</h2>
          <p className="text-slate-500 text-sm mb-6">Sua indicação foi enviada. Acompanhe o status no painel de indicações.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setForm({ client_name:'',client_cpf:'',client_whatsapp:'',client_email:'',product_name:'',estimated_value:'',notes:'' }); setSuccess(false); }}
              className="px-5 py-2.5 bg-[#0C2D48] hover:bg-[#5a1eaf] text-white font-semibold rounded-xl transition-all text-sm"
            >
              Nova Indicação
            </button>
            <Link to="/indicador/minhas-indicacoes" className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl transition-all text-sm">
              Ver Indicações
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const catLabel = { alta: 'Alta (1%)', media: 'Média (0,7%)', baixa: 'Baixa (0,2%)' };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#0C2D48]/10 rounded-xl flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-[#0C2D48]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Indicar Cliente</h1>
          <p className="text-slate-500 text-sm">Preencha os dados do cliente que deseja indicar</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div>
          <label className="label">Nome completo do cliente *</label>
          <input
            type="text"
            value={form.client_name}
            onChange={e => set('client_name', e.target.value)}
            placeholder="Nome completo"
            className={`input ${errors.client_name ? 'border-red-400' : ''}`}
          />
          {errors.client_name && <p className="text-red-500 text-xs mt-1">{errors.client_name}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">CPF do cliente *</label>
            <input
              type="text"
              value={form.client_cpf}
              onChange={e => set('client_cpf', maskCPF(e.target.value))}
              placeholder="000.000.000-00"
              className={`input ${errors.client_cpf ? 'border-red-400' : ''}`}
            />
            {errors.client_cpf && <p className="text-red-500 text-xs mt-1">{errors.client_cpf}</p>}
          </div>
          <div>
            <label className="label">WhatsApp do cliente *</label>
            <input
              type="text"
              value={form.client_whatsapp}
              onChange={e => set('client_whatsapp', maskPhone(e.target.value))}
              placeholder="(62) 99999-0000"
              className={`input ${errors.client_whatsapp ? 'border-red-400' : ''}`}
            />
            {errors.client_whatsapp && <p className="text-red-500 text-xs mt-1">{errors.client_whatsapp}</p>}
          </div>
        </div>

        <div>
          <label className="label">E-mail do cliente (opcional)</label>
          <input
            type="email"
            value={form.client_email}
            onChange={e => set('client_email', e.target.value)}
            placeholder="cliente@email.com"
            className="input"
          />
        </div>

        <div>
          <label className="label">Produto *</label>
          <select
            value={form.product_name}
            onChange={e => set('product_name', e.target.value)}
            className={`input ${errors.product_name ? 'border-red-400' : ''}`}
          >
            <option value="">Selecione um produto...</option>
            {['alta','media','baixa'].map(cat => (
              <optgroup key={cat} label={`Faixa ${catLabel[cat]}`}>
                {products.filter(p => p.category === cat).map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {errors.product_name && <p className="text-red-500 text-xs mt-1">{errors.product_name}</p>}
        </div>

        <div>
          <label className="label">Valor estimado da operação (opcional)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.estimated_value}
            onChange={e => set('estimated_value', e.target.value)}
            placeholder="Ex: 15000"
            className="input"
          />
          {estimatedCommission !== null && (
            <div className="mt-2 p-3 bg-[#0C2D48]/5 border border-[#0C2D48]/20 rounded-xl">
              <p className="text-xs text-slate-500">Comissão estimada para você:</p>
              <p className="text-lg font-bold text-[#0C2D48]">{formatBRL(estimatedCommission)}</p>
            </div>
          )}
        </div>

        <div>
          <label className="label">Observações (opcional)</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Alguma informação adicional sobre o cliente ou a operação..."
            className="input resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <UserPlus className="w-4 h-4" /> Registrar Indicação
            </>
          )}
        </button>
      </form>
    </div>
  );
}
