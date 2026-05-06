import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { UserPlus, Phone, Package, CheckCircle2, Copy, Clock, MessageSquare } from 'lucide-react';

export default function NewReferral() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ client_name: '', client_whatsapp: '', product_id: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/products').then(r => setProducts(r.data.filter(p => p.is_active)));
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === 'client_whatsapp') {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      const fmt = digits.length <= 2 ? digits
        : digits.length <= 7 ? `(${digits.slice(0,2)}) ${digits.slice(2)}`
        : `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
      setForm(f => ({ ...f, client_whatsapp: fmt }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.client_name.trim() || !form.client_whatsapp || !form.product_id) {
      toast.error('Preencha todos os campos');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        client_whatsapp: form.client_whatsapp.replace(/\D/g, ''),
        product_id: parseInt(form.product_id),
      };
      const res = await api.post('/referrals', payload);
      setSuccess(res.data);
      toast.success('Indicação registrada! WhatsApp enviado ao cliente.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao registrar indicação');
    } finally {
      setLoading(false);
    }
  }

  function copyProtocol() {
    navigator.clipboard.writeText(success.protocol);
    toast.success('Protocolo copiado!');
  }

  function reset() {
    setSuccess(null);
    setForm({ client_name: '', client_whatsapp: '', product_id: '' });
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card-gold text-center space-y-5">
          <div className="inline-flex w-16 h-16 rounded-full bg-green-900/40 border border-green-700/40 items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Indicação Registrada!</h2>
            <p className="text-movv-400 text-sm mt-1">
              WhatsApp enviado para <strong className="text-white">{success.client_name}</strong>
            </p>
          </div>

          <div className="bg-movv-900/60 rounded-2xl p-5 border border-movv-600 space-y-3">
            <div>
              <p className="text-movv-400 text-xs uppercase tracking-wider mb-1">Protocolo</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-gradient text-2xl font-bold font-mono tracking-widest">
                  {success.protocol}
                </span>
                <button onClick={copyProtocol} className="text-movv-400 hover:text-gold-400 transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoItem label="Produto" value={success.product_name} />
              <InfoItem label="Validade" value="30 dias" icon={<Clock className="w-3 h-3" />} />
            </div>
          </div>

          <div className="flex items-center gap-2 bg-green-900/20 border border-green-700/30 rounded-xl p-3 text-sm text-green-300">
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <span>Mensagem enviada via WhatsApp ao cliente</span>
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="btn-primary flex-1">Nova Indicação</button>
            <button onClick={() => navigate('/')} className="btn-secondary flex-1">Ir ao Painel</button>
          </div>
        </div>
      </div>
    );
  }

  const selectedProduct = products.find(p => p.id === parseInt(form.product_id));

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Indicar Cliente</h1>
        <p className="text-movv-400 text-sm mt-1">Cadastre um novo cliente e gere o protocolo de indicação</p>
      </div>

      {/* Commission preview */}
      {selectedProduct && (
        <div className="bg-gold-900/20 border border-gold-700/30 rounded-2xl p-4">
          <p className="text-gold-300 text-xs font-semibold uppercase tracking-wider mb-2">Comissão prevista</p>
          <CommissionPreview product={selectedProduct} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="label">Nome completo do cliente</label>
          <div className="relative">
            <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-movv-400" />
            <input
              name="client_name"
              value={form.client_name}
              onChange={handleChange}
              placeholder="Ex: João da Silva"
              className="input pl-10"
              required
            />
          </div>
        </div>

        <div>
          <label className="label">WhatsApp do cliente</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-movv-400" />
            <input
              name="client_whatsapp"
              value={form.client_whatsapp}
              onChange={handleChange}
              placeholder="(64) 99999-9999"
              className="input pl-10"
              required
              inputMode="numeric"
            />
          </div>
          <p className="text-movv-500 text-xs mt-1">A mensagem de protocolo será enviada automaticamente</p>
        </div>

        <div>
          <label className="label">Produto de interesse</label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-movv-400 pointer-events-none" />
            <select
              name="product_id"
              value={form.product_id}
              onChange={handleChange}
              className="input pl-10 appearance-none"
              required
            >
              <option value="">Selecione o produto</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* WhatsApp note */}
        <div className="flex items-start gap-3 bg-movv-900/60 rounded-xl p-3 text-sm text-movv-400 border border-movv-700/50">
          <MessageSquare className="w-4 h-4 mt-0.5 text-green-400 flex-shrink-0" />
          <p>Ao confirmar, o cliente receberá o protocolo automaticamente via WhatsApp com os dados da indicação.</p>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
          {loading
            ? <span className="w-5 h-5 border-2 border-movv-900 border-t-transparent rounded-full animate-spin" />
            : <><UserPlus className="w-4 h-4" /> Registrar Indicação</>
          }
        </button>
      </form>
    </div>
  );
}

function InfoItem({ label, value, icon }) {
  return (
    <div className="bg-movv-800/60 rounded-lg p-2.5">
      <p className="text-movv-500 text-xs">{label}</p>
      <p className="text-white text-sm font-medium flex items-center gap-1 mt-0.5">
        {icon}{value}
      </p>
    </div>
  );
}

function CommissionPreview({ product }) {
  if (product.type === 'digital_certificate') {
    return <p className="text-gold-300 text-sm">100% para contabilidade (independente do valor)</p>;
  }
  if (product.type === 'bpo') {
    return (
      <div className="text-sm text-gold-300 space-y-0.5">
        <p>1º mês: <strong>R$ 699,50</strong> (50% de R$1.399)</p>
        <p>2º mês+: <strong>R$ 69,95/mês</strong> (5% recorrente)</p>
      </div>
    );
  }
  return (
    <div className="text-sm text-gold-300 space-y-0.5">
      <p>1% do valor operado, sendo:</p>
      <p>• <strong>60%</strong> para você · <strong>40%</strong> para a contabilidade</p>
    </div>
  );
}
