import { useEffect, useState } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import { Building2, Loader2, Pencil, ToggleLeft, ToggleRight, Trash2, Plus, AlertTriangle } from 'lucide-react';

function maskCNPJ(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

// Cadastro da contabilidade em si — sem preço/comissão fixos (Fernando
// negocia isso caso a caso, direto no registro de cada venda). Ver
// contabilidadesPrecosController no backend.
const EMPTY_FORM = {
  razao_social: '', cnpj: '', endereco: '', cidade: '', whatsapp: '', email: '', responsavel_nome: '', observacoes: '',
};

function formFromRow(row) {
  return {
    razao_social: row.name || '',
    cnpj: maskCNPJ(row.cnpj || ''),
    endereco: row.endereco || '',
    cidade: row.cidade || '',
    whatsapp: row.whatsapp || '',
    email: row.email?.includes('@placeholder.iubmais.local') ? '' : (row.email || ''),
    responsavel_nome: row.responsavel_nome || '',
    observacoes: row.observacoes || '',
  };
}

export default function DiretaContabilidades() {
  const [contabilidades, setContabilidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'create' | 'edit'
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [modalDelete, setModalDelete] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/contabilidades-precos');
      setContabilidades(res.data);
    } catch { toast.error('Erro ao carregar contabilidades'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setSelected(null);
    setForm(EMPTY_FORM);
    setModal('create');
  }

  function openEdit(row) {
    setSelected(row);
    setForm(formFromRow(row));
    setModal('edit');
  }

  const podeSalvar = form.razao_social.trim() && form.cnpj.replace(/\D/g, '').length === 14;

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        razao_social: form.razao_social.trim(),
        cnpj: form.cnpj,
        endereco: form.endereco.trim() || null,
        cidade: form.cidade.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        responsavel_nome: form.responsavel_nome.trim() || null,
        observacoes: form.observacoes.trim() || null,
      };
      if (modal === 'create') {
        await api.post('/contabilidades-precos', payload);
        toast.success('Contabilidade cadastrada!');
      } else {
        await api.put(`/contabilidades-precos/${selected.partner_id}`, payload);
        toast.success('Contabilidade atualizada!');
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  async function toggleAtivo(row) {
    try {
      await api.patch(`/contabilidades-precos/${row.partner_id}/ativo`, { ativo: !row.ativo });
      load();
    } catch { toast.error('Erro ao atualizar'); }
  }

  async function handleDelete() {
    if (!modalDelete) return;
    try {
      await api.delete(`/contabilidades-precos/${modalDelete.partner_id}`);
      toast.success('Contabilidade excluída.');
      setModalDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao excluir');
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#0C2D48]" />
            Contabilidades Parceiras
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Cadastro das contabilidades usadas nas vendas via contabilidade — valor e comissão são negociados em cada venda, não aqui.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 whitespace-nowrap">
          <Plus className="w-4 h-4" /> Nova Contabilidade
        </button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Contabilidade','CNPJ','Cidade','Responsável','Status','Ações'].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">Carregando...</td></tr>
              ) : contabilidades.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">Nenhuma contabilidade cadastrada</td></tr>
              ) : contabilidades.map(row => (
                <tr key={row.partner_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-slate-900 font-medium">{row.name}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-500">{row.cnpj ? maskCNPJ(row.cnpj) : '—'}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{row.cidade || '—'}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{row.responsavel_nome || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={row.ativo ? 'badge-converted' : 'badge-expired'}>{row.ativo ? 'Ativa' : 'Inativa'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleAtivo(row)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors" title={row.ativo ? 'Desativar' : 'Ativar'}>
                        {row.ativo ? <ToggleRight className="w-3.5 h-3.5 text-[#1B5E20]" /> : <ToggleLeft className="w-3.5 h-3.5 text-red-500" />}
                      </button>
                      <button onClick={() => setModalDelete(row)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Excluir">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? 'Nova Contabilidade' : `Editar — ${selected?.name}`}>
        <div className="space-y-4">
          <div>
            <label className="label">Razão Social *</label>
            <input className="input" value={form.razao_social} onChange={e => set('razao_social', e.target.value)} placeholder="Nome da contabilidade" />
          </div>
          <div>
            <label className="label">CNPJ *</label>
            <input className="input" inputMode="numeric" value={form.cnpj} onChange={e => set('cnpj', maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <label className="label">Endereço (opcional)</label>
            <input className="input" value={form.endereco} onChange={e => set('endereco', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cidade (opcional)</label>
              <input className="input" value={form.cidade} onChange={e => set('cidade', e.target.value)} />
            </div>
            <div>
              <label className="label">Telefone/WhatsApp (opcional)</label>
              <input className="input" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email (opcional)</label>
              <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contato@contabilidade.com" />
            </div>
            <div>
              <label className="label">Responsável (opcional)</label>
              <input className="input" value={form.responsavel_nome} onChange={e => set('responsavel_nome', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Observações (opcional)</label>
            <textarea className="input min-h-[60px] resize-none" value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !podeSalvar} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </Modal>

      {modalDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">Excluir contabilidade</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{modalDelete.name}</p>
                </div>
              </div>
              <p className="text-slate-600 text-sm mt-4">
                Ela some da lista de contabilidades disponíveis pra novas vendas, mas as vendas já registradas com ela continuam intactas no histórico.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModalDelete(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleDelete} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                <Trash2 className="w-4 h-4" /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
