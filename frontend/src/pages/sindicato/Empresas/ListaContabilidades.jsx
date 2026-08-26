import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import { Building2, Loader2, ChevronRight, Plus } from 'lucide-react';

const EMPTY_FORM = { nome_fantasia: '', razao_social: '', cnpj: '', telefone: '', email: '', endereco: '' };

export default function SindicatoEmpresasListaContabilidades() {
  const navigate = useNavigate();
  const [contabilidades, setContabilidades] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalNova, setModalNova] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/sindicato-empresas/contabilidades');
      setContabilidades(res.data);
    } catch { toast.error('Erro ao carregar contabilidades'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNova() {
    setForm(EMPTY_FORM);
    setModalNova(true);
  }

  async function handleCreate() {
    setSaving(true);
    try {
      await api.post('/sindicato-empresas/contabilidades', form);
      toast.success('Contabilidade cadastrada!');
      setModalNova(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao cadastrar contabilidade');
    } finally { setSaving(false); }
  }

  const podeSalvar = form.nome_fantasia.trim().length > 0;

  if (loading) return (
    <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-[#0C2D48]" /></div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#0C2D48]" />
            Empresas
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Contabilidades parceiras do Sindicato — escolha uma para ver e cobrar as empresas vinculadas.
          </p>
        </div>
        <button
          onClick={openNova}
          className="flex items-center gap-2 whitespace-nowrap bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200"
        >
          <Plus className="w-4 h-4" /> Nova Contabilidade
        </button>
      </div>

      {contabilidades.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">Nenhuma contabilidade cadastrada</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contabilidades.map(c => (
            <button
              key={c.id}
              onClick={() => navigate(`/sindicato/empresas/contabilidade/${c.id}`)}
              className="card text-left hover:border-[#C9A84C]/50 hover:shadow-gold transition-all duration-200 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{c.nome_fantasia || c.razao_social}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{c.cnpj || 'CNPJ não informado'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{c.cidade || '—'}{c.estado ? `/${c.estado}` : ''}</span>
                <span className="badge-approved">{c.total_empresas} {c.total_empresas === 1 ? 'empresa' : 'empresas'}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={modalNova} onClose={() => setModalNova(false)} title="Nova Contabilidade">
        <div className="space-y-4">
          <div>
            <label className="label">Nome Fantasia</label>
            <input className="input" value={form.nome_fantasia} onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="label">Razão Social</label>
            <input className="input" value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} />
          </div>
          <div>
            <label className="label">CNPJ</label>
            <input className="input" value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Telefone</label>
              <input className="input" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Endereço (opcional)</label>
            <input className="input" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setModalNova(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleCreate} disabled={saving || !podeSalvar} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Cadastrar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
