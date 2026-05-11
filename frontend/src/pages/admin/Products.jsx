import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import Modal from '../../components/ui/Modal';

const TYPES = [
  { value: 'credit',    label: 'Crédito' },
  { value: 'bpo',       label: 'BPO Financeiro' },
  { value: 'insurance', label: 'Seguro' },
  { value: 'other',     label: 'Outro' },
];

const FAIXAS = {
  alta:     { label: 'ALTA',     titulo: 'Faixa Alta',      desc: '1,5% do valor operado', badgeCls: 'bg-emerald-100 text-emerald-700 border-emerald-300', dotCls: 'bg-emerald-500', btnSelected: 'bg-emerald-50 border-emerald-400 text-emerald-700' },
  media:    { label: 'MÉDIA',    titulo: 'Faixa Média',     desc: '1,0% do valor operado', badgeCls: 'bg-yellow-100 text-yellow-700 border-yellow-300',   dotCls: 'bg-yellow-500',  btnSelected: 'bg-yellow-50 border-yellow-400 text-yellow-700' },
  baixa:    { label: 'BAIXA',    titulo: 'Faixa Baixa',     desc: '0,3% do valor operado', badgeCls: 'bg-blue-100 text-blue-700 border-blue-300',         dotCls: 'bg-blue-500',    btnSelected: 'bg-blue-50 border-blue-400 text-blue-700' },
  especial: { label: 'ESPECIAL', titulo: 'Produto Especial', desc: 'Mensalidade R$1.399',   badgeCls: 'bg-purple-100 text-purple-700 border-purple-300',   dotCls: 'bg-purple-500',  btnSelected: 'bg-purple-50 border-purple-400 text-purple-700' },
};

const FAIXA_ORDER = ['alta', 'media', 'baixa', 'especial'];
const PERCENTUAIS  = { alta: 0.015, media: 0.01, baixa: 0.003, especial: 0 };
const EMPTY        = { name: '', type: 'credit', description: '', faixa: 'media' };

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const r = await api.get('/products');
      setProducts(r.data);
    } catch { toast.error('Erro ao carregar produtos'); }
    finally { setLoading(false); }
  }

  function openCreate() { setEditing(null); setForm(EMPTY); setModal(true); }

  function openEdit(p) {
    setEditing(p);
    setForm({ name: p.name, type: p.type, description: p.description || '', faixa: p.faixa || 'media' });
    setModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.type) { toast.error('Nome e tipo são obrigatórios'); return; }
    const rate = PERCENTUAIS[form.faixa] ?? 0.01;
    const payload = { ...form, commission_rate: rate, percentual_repasse: rate, is_active: editing ? editing.is_active : true };
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, payload);
        toast.success('Produto atualizado!');
      } else {
        await api.post('/products', payload);
        toast.success('Produto criado!');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  async function toggleActive(p) {
    try {
      await api.put(`/products/${p.id}`, { ...p, is_active: !p.is_active });
      toast.success(p.is_active ? 'Produto desativado' : 'Produto ativado');
      load();
    } catch { toast.error('Erro ao atualizar'); }
  }

  const groups = FAIXA_ORDER.map(faixa => ({
    faixa,
    items: products.filter(p => (p.faixa || 'media') === faixa),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
          <p className="text-slate-500 text-sm mt-1">{products.length} produtos cadastrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      {/* Legenda de faixas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {FAIXA_ORDER.map(key => (
          <div key={key} className="bg-white border border-slate-200 rounded-xl p-3">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${FAIXAS[key].badgeCls}`}>
              {FAIXAS[key].label}
            </span>
            <p className="text-slate-500 text-xs mt-1.5">{FAIXAS[key].desc}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-2 border-movv-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groups.map(({ faixa, items }) => (
        <div key={faixa}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${FAIXAS[faixa].dotCls}`} />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              {FAIXAS[faixa].titulo} — {FAIXAS[faixa].desc}
            </h2>
            <span className="text-slate-400 text-xs">({items.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map(p => (
              <div key={p.id} className={`card flex flex-col justify-between ${!p.is_active ? 'opacity-50' : ''}`}>
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${FAIXAS[p.faixa || 'media'].badgeCls}`}>
                      {FAIXAS[p.faixa || 'media'].label}
                    </span>
                    <span className={p.is_active ? 'badge-converted' : 'badge-expired'}>
                      {p.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <h3 className="text-slate-900 font-semibold mt-2 text-sm">{p.name}</h3>
                  {p.description && (
                    <p className="text-slate-500 text-xs mt-1 line-clamp-2">{p.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
                  <button onClick={() => openEdit(p)} className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs py-2">
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>
                  <button onClick={() => toggleActive(p)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                    {p.is_active
                      ? <ToggleRight className="w-4 h-4 text-[#1B5E20]" />
                      : <ToggleLeft className="w-4 h-4 text-red-400" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Produto' : 'Novo Produto'}>
        <div className="space-y-4">
          <div>
            <label className="label">Nome do produto</label>
            <input className="input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Crédito Pessoal" />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input appearance-none" value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Faixa de Comissão</label>
            <div className="grid grid-cols-2 gap-2">
              {FAIXA_ORDER.map(key => (
                <button key={key} type="button"
                  onClick={() => setForm(f => ({ ...f, faixa: key }))}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    form.faixa === key ? FAIXAS[key].btnSelected : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                  <span className="text-xs font-bold">{FAIXAS[key].label}</span>
                  <p className="text-xs text-slate-500 mt-0.5">{FAIXAS[key].desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Descrição (opcional)</label>
            <textarea className="input resize-none h-20" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descrição breve do produto..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar Produto'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
