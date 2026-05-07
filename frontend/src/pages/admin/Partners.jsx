import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Users, Plus, Search, Edit2, Key, ToggleLeft, ToggleRight } from 'lucide-react';
import Modal from '../../components/ui/Modal';

const EMPTY_FORM = { name: '', email: '', type: 'employee', whatsapp: '', pix_key: '', parent_id: '', password: '', is_admin: false };

export default function AdminPartners() {
  const [partners, setPartners] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(partners.filter(p =>
      p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    ));
  }, [search, partners]);

  async function load() {
    try {
      const r = await api.get('/partners');
      setPartners(r.data);
      setFiltered(r.data);
    } catch { toast.error('Erro ao carregar parceiros'); }
    finally { setLoading(false); }
  }

  function openCreate() { setForm(EMPTY_FORM); setSelected(null); setModal('create'); }
  function openEdit(p) {
    setSelected(p);
    setForm({ name: p.name, email: p.email, type: p.type, whatsapp: p.whatsapp || '', pix_key: p.pix_key || '', parent_id: p.parent_id || '', password: '', is_admin: p.is_admin });
    setModal('edit');
  }
  function openReset(p) { setSelected(p); setForm({ password: '' }); setModal('reset'); }

  async function handleSave() {
    setSaving(true);
    try {
      if (modal === 'create') {
        await api.post('/partners', form);
        toast.success('Parceiro criado!');
      } else if (modal === 'edit') {
        await api.put(`/partners/${selected.id}`, form);
        toast.success('Parceiro atualizado!');
      } else if (modal === 'reset') {
        await api.put(`/partners/${selected.id}/reset-password`, { password: form.password });
        toast.success('Senha redefinida!');
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  async function toggleActive(p) {
    try {
      await api.put(`/partners/${p.id}`, { ...p, is_active: !p.is_active });
      toast.success(p.is_active ? 'Parceiro desativado' : 'Parceiro ativado');
      load();
    } catch { toast.error('Erro ao atualizar'); }
  }

  const accountingPartners = partners.filter(p => p.type === 'accounting');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parceiros</h1>
          <p className="text-slate-500 text-sm mt-1">{partners.length} parceiros cadastrados</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Parceiro
        </button>
      </div>

      {/* Search */}
      <div className="card py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, código ou email..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Código','Nome','Tipo','Email','WhatsApp','PIX','Vinculado a','Indicações','Saldo','Status','Ações'].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="text-center py-10 text-slate-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-10 text-slate-400">Nenhum parceiro encontrado</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${!p.is_active ? 'opacity-50' : ''}`}>
                  <td className="py-3 px-4 font-mono text-xs text-[#C9A84C]">{p.code}</td>
                  <td className="py-3 px-4 text-slate-900 font-medium whitespace-nowrap">
                    {p.name}
                    {p.is_admin && <span className="ml-2 text-xs bg-purple-50 text-movv-900 border border-purple-200 px-1.5 py-0.5 rounded">Admin</span>}
                  </td>
                  <td className="py-3 px-4">
                    <span className={p.type === 'accounting' ? 'badge-approved' : 'badge-pending'}>
                      {p.type === 'accounting' ? 'Contab.' : 'Func.'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 text-xs">{p.email}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{p.whatsapp || '—'}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs max-w-[120px] truncate">{p.pix_key || '—'}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{p.parent_name || '—'}</td>
                  <td className="py-3 px-4 text-center text-slate-700">{p.total_referrals || 0}</td>
                  <td className="py-3 px-4 text-right text-[#1B5E20] font-semibold whitespace-nowrap">
                    R$ {parseFloat(p.pending_balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4">
                    <span className={p.is_active ? 'badge-converted' : 'badge-expired'}>
                      {p.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Editar">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openReset(p)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-amber-600 transition-colors" title="Redefinir senha">
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleActive(p)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors" title={p.is_active ? 'Desativar' : 'Ativar'}>
                        {p.is_active ? <ToggleRight className="w-3.5 h-3.5 text-[#1B5E20]" /> : <ToggleLeft className="w-3.5 h-3.5 text-red-500" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Novo Parceiro' : modal === 'edit' ? 'Editar Parceiro' : 'Redefinir Senha'}
      >
        {modal === 'reset' ? (
          <div className="space-y-4">
            <p className="text-slate-500 text-sm">Nova senha para <strong className="text-slate-900">{selected?.name}</strong></p>
            <div>
              <label className="label">Nova Senha</label>
              <input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Nome completo</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do parceiro" />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input appearance-none" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="employee">Funcionário</option>
                  <option value="accounting">Contabilidade</option>
                </select>
              </div>
              <div>
                <label className="label">WhatsApp</label>
                <input className="input" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="64999999999" />
              </div>
              <div>
                <label className="label">Chave PIX</label>
                <input className="input" value={form.pix_key} onChange={e => setForm(f => ({ ...f, pix_key: e.target.value }))} placeholder="CPF, CNPJ ou e-mail" />
              </div>
              {form.type === 'employee' && (
                <div className="col-span-2">
                  <label className="label">Contabilidade vinculada</label>
                  <select className="input appearance-none" value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                    <option value="">Selecionar contabilidade</option>
                    {accountingPartners.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                </div>
              )}
              {modal === 'create' && (
                <div className="col-span-2">
                  <label className="label">Senha inicial</label>
                  <input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Salvando...' : modal === 'create' ? 'Criar Parceiro' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
