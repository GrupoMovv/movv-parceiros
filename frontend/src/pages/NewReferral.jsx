import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { UserPlus, Phone, Package, CheckCircle2, Copy, Clock, MessageSquare, TrendingUp, Mail } from 'lucide-react';

const FAIXAS = {
  alta:     { label: 'ALTA',     titulo: 'Faixa Alta — 1,5%',      badgeCls: 'bg-emerald-100 text-emerald-700 border-emerald-300', panelCls: 'bg-emerald-50 border-emerald-200' },
  media:    { label: 'MÉDIA',    titulo: 'Faixa Média — 1,0%',     badgeCls: 'bg-yellow-100 text-yellow-700 border-yellow-300',   panelCls: 'bg-yellow-50 border-yellow-200' },
  baixa:    { label: 'BAIXA',    titulo: 'Faixa Baixa — 0,3%',     badgeCls: 'bg-blue-100 text-blue-700 border-blue-300',         panelCls: 'bg-blue-50 border-blue-200' },
  especial: { label: 'ESPECIAL', titulo: 'BPO — Produto Especial',  badgeCls: 'bg-purple-100 text-purple-700 border-purple-300',   panelCls: 'bg-purple-50 border-purple-200' },
};

const FAIXA_ORDER = ['alta', 'media', 'baixa', 'especial'];

export default function NewReferral() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ client_name: '', client_whatsapp: '', client_email: '', product_id: '', valor_estimado: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/products').then(r => setProducts(r.data.filter(p => p.is_active)));
  }, []);

  const byFaixa = products.reduce((acc, p) => {
    const f = p.faixa || 'media';
    if (!acc[f]) acc[f] = [];
    acc[f].push(p);
    return acc;
  }, {});

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === 'client_whatsapp') {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      const fmt = digits.length <= 2 ? digits
        : digits.length <= 7 ? `(${digits.slice(0,2)}) ${digits.slice(2)}`
        : `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
      setForm(f => ({ ...f, client_whatsapp: fmt }));
    } else if (name === 'valor_estimado') {
      setForm(f => ({ ...f, valor_estimado: value.replace(/[^\d,]/g, '') }));
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
      const res = await api.post('/referrals', {
        client_name: form.client_name,
        client_whatsapp: form.client_whatsapp.replace(/\D/g, ''),
        product_id: parseInt(form.product_id),
        ...(form.client_email.trim() && { client_email: form.client_email.trim() }),
      });
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
    setForm({ client_name: '', client_whatsapp: '', client_email: '', product_id: '', valor_estimado: '' });
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card text-center space-y-5">
          <div className="inline-flex w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-[#1B5E20]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Indicação Registrada!</h2>
            <p className="text-slate-500 text-sm mt-1">
              WhatsApp enviado para <strong className="text-slate-900">{success.client_name}</strong>
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Protocolo</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-gradient text-2xl font-bold font-mono tracking-widest">{success.protocol}</span>
                <button onClick={copyProtocol} className="text-slate-400 hover:text-[#C9A84C] transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoItem label="Produto" value={success.product_name} />
              <InfoItem label="Validade" value="30 dias" icon={<Clock className="w-3 h-3" />} />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-[#1B5E20]">
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <span>Mensagem enviada via WhatsApp ao cliente</span>
          </div>
          {success.client_email && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span>Email com protocolo enviado para <strong>{success.client_email}</strong></span>
            </div>
          )}
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
        <h1 className="text-2xl font-bold text-slate-900">Indicar Cliente</h1>
        <p className="text-slate-500 text-sm mt-1">Cadastre um novo cliente e gere o protocolo de indicação</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="label">Nome completo do cliente</label>
          <div className="relative">
            <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input name="client_name" value={form.client_name} onChange={handleChange}
              placeholder="Ex: João da Silva" className="input pl-10" required />
          </div>
        </div>

        <div>
          <label className="label">WhatsApp do cliente</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input name="client_whatsapp" value={form.client_whatsapp} onChange={handleChange}
              placeholder="(64) 99999-9999" className="input pl-10" required inputMode="numeric" />
          </div>
          <p className="text-slate-400 text-xs mt-1">A mensagem de protocolo será enviada automaticamente</p>
        </div>

        <div>
          <label className="label">Email do cliente <span className="text-slate-400 font-normal">(opcional)</span></label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input name="client_email" type="email" value={form.client_email} onChange={handleChange}
              placeholder="cliente@email.com" className="input pl-10" />
          </div>
          <p className="text-slate-400 text-xs mt-1">Se informado, envia email com os dados da indicação ao cliente</p>
        </div>

        <div>
          <label className="label">Produto de interesse</label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select name="product_id" value={form.product_id} onChange={handleChange}
              className="input pl-10 appearance-none" required>
              <option value="">Selecione o produto</option>
              {FAIXA_ORDER.map(faixa =>
                byFaixa[faixa]?.length > 0 && (
                  <optgroup key={faixa} label={FAIXAS[faixa].titulo}>
                    {byFaixa[faixa].map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                )
              )}
            </select>
          </div>
        </div>

        {selectedProduct && (
          <div className={`rounded-2xl p-4 border space-y-3 ${FAIXAS[selectedProduct.faixa || 'media'].panelCls}`}>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${FAIXAS[selectedProduct.faixa || 'media'].badgeCls}`}>
                {FAIXAS[selectedProduct.faixa || 'media'].label}
              </span>
              <span className="text-sm font-medium text-slate-700">{selectedProduct.name}</span>
            </div>
            <CommissionPreview
              product={selectedProduct}
              valorEstimado={form.valor_estimado}
              onValorChange={handleChange}
            />
          </div>
        )}

        <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 text-sm text-slate-500 border border-slate-200">
          <MessageSquare className="w-4 h-4 mt-0.5 text-[#1B5E20] flex-shrink-0" />
          <p>Ao confirmar, o cliente receberá o protocolo automaticamente via WhatsApp com os dados da indicação.</p>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
          {loading
            ? <span className="w-5 h-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
            : <><UserPlus className="w-4 h-4" /> Registrar Indicação</>
          }
        </button>
      </form>
    </div>
  );
}

function InfoItem({ label, value, icon }) {
  return (
    <div className="bg-white rounded-lg p-2.5 border border-slate-200">
      <p className="text-slate-400 text-xs">{label}</p>
      <p className="text-slate-900 text-sm font-medium flex items-center gap-1 mt-0.5">{icon}{value}</p>
    </div>
  );
}

function CommissionPreview({ product, valorEstimado, onValorChange }) {
  const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (product.faixa === 'especial') {
    return (
      <div className="text-sm text-slate-700 space-y-1">
        <p className="font-semibold">Mensalidade do cliente: R$ 1.399,00</p>
        <p>1º mês: <strong>R$ 650,00</strong> ao parceiro</p>
        <p>2º mês em diante: <strong>R$ 70,00/mês</strong> recorrente</p>
        <p className="text-slate-500 text-xs mt-1">Divisão: 51% funcionário · 34% contabilidade · 15% imposto</p>
      </div>
    );
  }

  const percentual    = parseFloat(product.percentual_repasse) || 0.01;
  const valorNum      = parseFloat(String(valorEstimado).replace(/\./g, '').replace(',', '.')) || 0;
  const total         = valorNum * percentual;
  const funcionario   = total * 0.51;
  const contabilidade = total * 0.34;
  const imposto       = total * 0.15;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2 text-slate-600">
        <TrendingUp className="w-3.5 h-3.5" />
        <span>Repasse: <strong>{(percentual * 100).toFixed(1)}%</strong> do valor operado</span>
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Valor estimado da operação (opcional)</label>
        <input name="valor_estimado" value={valorEstimado} onChange={onValorChange}
          placeholder="Ex: 10000" className="input text-sm py-2" inputMode="numeric" />
      </div>
      {valorNum > 0 ? (
        <div className="bg-white/70 rounded-xl p-3 space-y-2 border border-white/80">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Sua comissão estimada</p>
          <p className="text-xl font-bold text-slate-900">{fmt(funcionario)}</p>
          <p className="text-xs text-slate-500">51% do total de {fmt(total)}</p>
          <div className="border-t border-slate-200/80 pt-2 space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Contabilidade (34%)</span>
              <span>{fmt(contabilidade)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400 italic">
              <span>Imposto (15%) — retido pela contabilidade</span>
              <span>{fmt(imposto)}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-slate-400 text-xs">Digite o valor estimado para ver sua comissão</p>
      )}
    </div>
  );
}
