import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import { Building2, Loader2, Search, Plus, ArrowLeft } from 'lucide-react';

const EMPTY_FORM = { razao_social: '', nome_fantasia: '', cnpj: '', telefone: '', celular: '', whatsapp: '', status: 'Ativo' };

export default function SindicatoEmpresasDaContabilidade() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalNova, setModalNova] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (searchTerm) => {
    setLoading(true);
    try {
      const res = await api.get(`/sindicato-empresas/contabilidades/${id}/empresas`, {
        params: searchTerm ? { search: searchTerm } : {},
      });
      setEmpresas(res.data);
    } catch { toast.error('Erro ao carregar empresas'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function openNova() {
    setForm(EMPTY_FORM);
    setModalNova(true);
  }

  async function handleCreate() {
    setSaving(true);
    try {
      await api.post('/sindicato-empresas/empresas', { ...form, contabilidade_id: id });
      toast.success('Empresa cadastrada!');
      setModalNova(false);
      load(search);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao cadastrar empresa');
    } finally { setSaving(false); }
  }

  const podeSalvar = form.razao_social.trim().length > 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <Link to="/sindicato/empresas" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Contabilidades
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mt-2">
          <Building2 className="w-6 h-6 text-[#0C2D48]" />
          Empresas
        </h1>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input pl-9"
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button onClick={openNova} className="btn-primary flex items-center gap-2 whitespace-nowrap">
          <Plus className="w-4 h-4" /> Nova Empresa
        </button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Nome Fantasia', 'CNPJ', 'Telefone', 'Status'].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              ) : empresas.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-slate-400">Nenhuma empresa encontrada</td></tr>
              ) : empresas.map(e => (
                <tr
                  key={e.id}
                  onClick={() => navigate(`/sindicato/empresas/detalhe/${e.id}`)}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4 text-slate-900 font-medium">{e.nome_fantasia || e.razao_social}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-500">{e.cnpj || '—'}</td>
                  <td className="py-3 px-4 text-slate-600">{e.telefone || e.celular || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={e.status === 'Ativo' ? 'badge-converted' : 'badge-expired'}>{e.status || '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalNova} onClose={() => setModalNova(false)} title="Nova Empresa">
        <div className="space-y-4">
          <div>
            <label className="label">Razão Social</label>
            <input className="input" value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} />
          </div>
          <div>
            <label className="label">Nome Fantasia</label>
            <input className="input" value={form.nome_fantasia} onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))} />
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
              <label className="label">WhatsApp</label>
              <input className="input" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="64999998888" />
            </div>
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
