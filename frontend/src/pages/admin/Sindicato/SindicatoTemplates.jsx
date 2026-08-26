import { useEffect, useState, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import { MessagesSquare, Loader2, Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';

const EMPTY_FORM = { tipo: 'beneficios', titulo: '', conteudo: '', ativo: true };

export default function SindicatoTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(null); // 'create' | 'edit'
  const [alvoId, setAlvoId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/sindicato-beneficios/templates');
      setTemplates(res.data);
    } catch { toast.error('Erro ao carregar templates'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setModal('create');
  }

  function openEdit(t) {
    setForm({ tipo: t.tipo, titulo: t.titulo, conteudo: t.conteudo, ativo: t.ativo });
    setAlvoId(t.id);
    setModal('edit');
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (modal === 'create') {
        await api.post('/sindicato-beneficios/templates', form);
        toast.success('Template criado!');
      } else {
        await api.put(`/sindicato-beneficios/templates/${alvoId}`, form);
        toast.success('Template atualizado!');
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar template');
    } finally { setSaving(false); }
  }

  async function toggleAtivo(t) {
    try {
      await api.put(`/sindicato-beneficios/templates/${t.id}`, { ativo: !t.ativo });
      load();
    } catch { toast.error('Erro ao atualizar template'); }
  }

  const podeSalvar = form.tipo.trim() && form.titulo.trim() && form.conteudo.trim();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessagesSquare className="w-6 h-6 text-[#0C2D48]" />
            Templates de Benefícios
          </h1>
          <p className="text-slate-500 text-sm mt-1">Mensagens que o Renan usa pra divulgar os benefícios do SECI.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 whitespace-nowrap">
          <Plus className="w-4 h-4" /> Novo Template
        </button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Título', 'Tipo', 'Status', 'Ações'].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              ) : templates.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-slate-400">Nenhum template cadastrado</td></tr>
              ) : templates.map(t => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-slate-900 font-medium">{t.titulo}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-500">{t.tipo}</td>
                  <td className="py-3 px-4">
                    <span className={t.ativo ? 'badge-converted' : 'badge-expired'}>{t.ativo ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleAtivo(t)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors" title={t.ativo ? 'Desativar' : 'Ativar'}>
                        {t.ativo ? <ToggleRight className="w-3.5 h-3.5 text-[#1B5E20]" /> : <ToggleLeft className="w-3.5 h-3.5 text-red-500" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? 'Novo Template' : 'Editar Template'} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <input className="input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} placeholder="beneficios" />
            </div>
            <div>
              <label className="label">Título</label>
              <input className="input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Conteúdo</label>
            <textarea className="input min-h-[280px] resize-y font-mono text-xs" value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
            Ativo (visível pro Renan escolher)
          </label>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !podeSalvar} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
