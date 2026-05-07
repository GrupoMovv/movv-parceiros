import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Package, Plus, Edit2, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import Modal from '../../components/ui/Modal';

const TYPES = [
  { value: 'credit',              label: 'Crédito' },
  { value: 'bpo',                 label: 'BPO Financeiro' },
  { value: 'digital_certificate', label: 'Certificado Digital' },
  { value: 'account',             label: 'Conta Bancária' },
  { value: 'insurance',           label: 'Seguro' },
  { value: 'other',               label: 'Outro' },
];

const TYPE_RULES = {
  digital_certificate: '100% à contabilidade, independente do valor',
  bpo:                 '1º mês: 50% do plano (R$699,50) · 2º mês+: 5% recorrente (R$69,95)',
  credit:              '1% do valor operado: 60% func. / 40% contab.',
  account:             '1% do valor operado: 60% func. / 40% contab.',
  insurance:           '1% do valor operado: 60% func. / 40% contab.',
  other:               '1% do valor operado: 60% func. / 40% contab.',
};

const EMPTY = { name: '', type: 'credit', description: '', commission_rate: 0.01 };

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
    setForm({ name: p.name, type: p.type, description: p.description || '', commission_rate: p.commission_rate });
    setModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.type) { toast.error('Nome e tipo são obrigatórios'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, { ...form, is_active: editing.is_active });
        toast.success('Produto atualizado!');
      } else {
        await api.post('/products', form);
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
          <p className="text-slate-500 text-sm mt-1">{products.length} produtos cadastrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      {/* Commission rules reference */}
      <div className="bg-[#FDF8ED] border border-[#C9A84C]/30 rounded-2xl p-4">
        <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" /> Regras de Comissão
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {TYPES.map(t => (
            <div key={t.value} className="flex gap-2">
              <span className="text-[#C9A84C] font-medium whitespace-nowrap">{t.label}:</span>
              <span className="text-slate-600">{TYPE_RULES[t.value]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 flex justify-center py-10">
            <div className="w-7 h-7 border-2 border-movv-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.map(p => (
          <div key={p.id} className={`card flex flex-col justify-between ${!p.is_active ? 'opacity-50' : ''}`}>
            <div>
              <div className="flex items-start justify-between mb-2">
                <div className="inline-flex p-2 rounded-lg bg-purple-50">
                  <Package className="w-4 h-4 text-movv-900" />
                </div>
                <span className={p.is_active ? 'badge-converted' : 'badge-expired'}>
                  {p.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <h3 className="text-slate-900 font-semibold mt-3">{p.name}</h3>
              <span className="inline-block mt-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                {TYPES.find(t => t.value === p.type)?.label || p.type}
              </span>
              {p.description && (
                <p className="text-slate-500 text-xs mt-2 line-clamp-2">{p.description}</p>
              )}
              <p className="text-slate-400 text-xs mt-2">{TYPE_RULES[p.type]}</p>
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

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Produto' : 'Novo Produto'}>
        <div className="space-y-4">
          <div>
            <label className="label">Nome do produto</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Crédito Empresarial" />
          </div>
          <div>
            <label className="label">Tipo / Categoria</label>
            <select className="input appearance-none" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {form.type && (
              <p className="text-slate-400 text-xs mt-1">{TYPE_RULES[form.type]}</p>
            )}
          </div>
          <div>
            <label className="label">Descrição (opcional)</label>
            <textarea
              className="input resize-none h-20"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descrição breve do produto..."
            />
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
