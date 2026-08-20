import { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import CurrencyInput from '../../../components/ui/CurrencyInput';
import { Building2, Loader2, Pencil, ToggleLeft, ToggleRight, Trash2, Plus, AlertTriangle, UserPlus } from 'lucide-react';

const fmt = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PRECO_BLOQUEIO_MINIMO = 30.00; // abaixo disso: bloqueado
const PRECO_ALERTA_MAXIMO   = 45.00; // [BLOQUEIO_MINIMO, ALERTA_MAXIMO): exige motivo

function validarPrecoContabilidade(preco) {
  const p = parseFloat(preco);
  if (isNaN(p) || p === 0) return { bloqueado: false, precisaMotivo: false, aviso: null };
  if (p < PRECO_BLOQUEIO_MINIMO) {
    return { bloqueado: true, precisaMotivo: false, aviso: `Preço não pode ser menor que R$ ${PRECO_BLOQUEIO_MINIMO.toFixed(2)}.` };
  }
  if (p < PRECO_ALERTA_MAXIMO) {
    return { bloqueado: false, precisaMotivo: true, aviso: `Preço abaixo de R$ ${PRECO_ALERTA_MAXIMO.toFixed(2)} — informe o motivo.` };
  }
  return { bloqueado: false, precisaMotivo: false, aviso: null };
}

const EMPTY_FORM = { preco_certificado: 0, observacoes: '' };
const EMPTY_CONTAB_FORM = { name: '', email: '', whatsapp: '', pix_key: '', password: '' };

export default function DiretaContabilidades() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;

  const [precos, setPrecos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'create' | 'edit'
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [motivoReduzido, setMotivoReduzido] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalDelete, setModalDelete] = useState(null);

  const [modalNovaContab, setModalNovaContab] = useState(false);
  const [contabForm, setContabForm] = useState(EMPTY_CONTAB_FORM);
  const [savingContab, setSavingContab] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/contabilidades-precos');
      setPrecos(res.data);
    } catch { toast.error('Erro ao carregar contabilidades'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate(row) {
    setSelected(row);
    setForm(EMPTY_FORM);
    setMotivoReduzido('');
    setModal('create');
  }

  function openEdit(row) {
    setSelected(row);
    setForm({ preco_certificado: parseFloat(row.preco_certificado), observacoes: row.observacoes || '' });
    setMotivoReduzido('');
    setModal('edit');
  }

  const precoNum = parseFloat(form.preco_certificado) || 0;
  const { bloqueado, precisaMotivo, aviso } = validarPrecoContabilidade(precoNum);
  const podeSalvarPreco = precoNum > 0 && !bloqueado && (!precisaMotivo || motivoReduzido.trim());

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        preco_certificado: form.preco_certificado,
        observacoes: form.observacoes || null,
        motivo_preco_reduzido: precisaMotivo ? motivoReduzido.trim() : undefined,
      };
      if (modal === 'create') {
        await api.post('/contabilidades-precos', { partner_id: selected.partner_id, ...payload });
        toast.success('Preço cadastrado!');
      } else {
        await api.put(`/contabilidades-precos/${selected.id}`, payload);
        toast.success('Preço atualizado!');
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  async function toggleAtivo(row) {
    try {
      await api.put(`/contabilidades-precos/${row.id}`, { ativo: !row.ativo });
      load();
    } catch { toast.error('Erro ao atualizar'); }
  }

  async function handleDelete() {
    if (!modalDelete) return;
    try {
      await api.delete(`/contabilidades-precos/${modalDelete.id}`);
      toast.success('Preço removido.');
      setModalDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao remover');
    }
  }

  function openNovaContab() {
    setContabForm(EMPTY_CONTAB_FORM);
    setModalNovaContab(true);
  }

  async function handleCreateContab() {
    setSavingContab(true);
    try {
      await api.post('/partners', { ...contabForm, type: 'accounting' });
      toast.success('Contabilidade cadastrada! Agora cadastre o preço do certificado.');
      setModalNovaContab(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao cadastrar contabilidade');
    } finally { setSavingContab(false); }
  }

  const podeSalvarContab = contabForm.name.trim() && contabForm.email.trim() && contabForm.password.trim().length >= 6;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#0C2D48]" />
            Preços por Contabilidade
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Preço de certificado cobrado pela Movv em vendas via cada contabilidade parceira.
          </p>
        </div>
        <button onClick={openNovaContab} className="btn-primary flex items-center gap-2 whitespace-nowrap">
          <UserPlus className="w-4 h-4" /> Nova Contabilidade
        </button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Contabilidade','Código','Preço do certificado','Status','Observações','Ações'].map(h => (
                  <th key={h} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">Carregando...</td></tr>
              ) : precos.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">Nenhuma contabilidade cadastrada</td></tr>
              ) : precos.map(row => (
                <tr key={row.partner_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-slate-900 font-medium">{row.name}</td>
                  <td className="py-3 px-4 font-mono text-xs text-[#C9A84C]">{row.code}</td>
                  <td className="py-3 px-4">
                    {row.id ? fmt(row.preco_certificado) : <span className="text-slate-400 text-xs">Não cadastrado</span>}
                  </td>
                  <td className="py-3 px-4">
                    {row.id && (
                      <span className={row.ativo ? 'badge-converted' : 'badge-expired'}>{row.ativo ? 'Ativo' : 'Inativo'}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs max-w-[200px] truncate">{row.observacoes || '—'}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      {row.id ? (
                        <>
                          <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Editar preço">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => toggleAtivo(row)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors" title={row.ativo ? 'Desativar' : 'Ativar'}>
                            {row.ativo ? <ToggleRight className="w-3.5 h-3.5 text-[#1B5E20]" /> : <ToggleLeft className="w-3.5 h-3.5 text-red-500" />}
                          </button>
                          {isAdmin && (
                            <button onClick={() => setModalDelete(row)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Remover">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <button onClick={() => openCreate(row)} className="flex items-center gap-1 text-xs font-semibold text-[#0C2D48] border border-blue-200 bg-blue-50 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                          <Plus className="w-3.5 h-3.5" /> Cadastrar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? `Cadastrar preço — ${selected?.name}` : `Editar preço — ${selected?.name}`}>
        <div className="space-y-4">
          <div>
            <label className="label">Preço do certificado</label>
            <CurrencyInput value={form.preco_certificado} onChange={v => { setForm(f => ({ ...f, preco_certificado: v })); setMotivoReduzido(''); }} placeholder="170,00" />
          </div>

          {aviso && (
            <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 border ${bloqueado ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${bloqueado ? 'text-red-600' : 'text-amber-600'}`} />
              <div className="flex-1">
                <p className={`text-xs ${bloqueado ? 'text-red-700' : 'text-amber-800'}`}>{aviso}</p>
                {precisaMotivo && (
                  <div className="mt-2">
                    <label className="text-xs font-medium text-amber-800">Motivo do preço reduzido</label>
                    <textarea
                      className="input min-h-[50px] resize-none mt-1"
                      value={motivoReduzido}
                      onChange={e => setMotivoReduzido(e.target.value)}
                      placeholder="Explique por que este preço ficou abaixo de R$ 45,00"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="label">Observações (opcional)</label>
            <textarea className="input min-h-[60px] resize-none" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !podeSalvarPreco} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modalNovaContab} onClose={() => setModalNovaContab(false)} title="Nova Contabilidade Parceira">
        <div className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={contabForm.name} onChange={e => setContabForm(f => ({ ...f, name: e.target.value }))} placeholder="Razão social ou nome fantasia" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={contabForm.email} onChange={e => setContabForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@contabilidade.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">WhatsApp (opcional)</label>
              <input className="input" value={contabForm.whatsapp} onChange={e => setContabForm(f => ({ ...f, whatsapp: e.target.value }))} />
            </div>
            <div>
              <label className="label">Chave PIX (opcional)</label>
              <input className="input" value={contabForm.pix_key} onChange={e => setContabForm(f => ({ ...f, pix_key: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Senha de acesso</label>
            <input type="text" className="input" value={contabForm.password} onChange={e => setContabForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setModalNovaContab(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleCreateContab} disabled={savingContab || !podeSalvarContab} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {savingContab && <Loader2 className="w-4 h-4 animate-spin" />}
              Cadastrar
            </button>
          </div>
        </div>
      </Modal>

      {modalDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5">
              <h2 className="font-bold text-slate-900 text-lg">Remover preço</h2>
              <p className="text-slate-600 text-sm mt-2">
                Remover o preço cadastrado para <strong>{modalDelete.name}</strong>? Vendas futuras via esta
                contabilidade serão bloqueadas até um novo preço ser cadastrado.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModalDelete(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleDelete} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                <Trash2 className="w-4 h-4" /> Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
