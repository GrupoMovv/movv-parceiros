import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import { Building2, Loader2, ArrowLeft, MessageCircle, Pencil, Clock, ArrowLeftRight, Search } from 'lucide-react';

const fmtDate = d => d ? d.slice(0, 10).split('-').reverse().join('/') : '—';

export default function SindicatoEmpresaDetalhe() {
  const { id } = useParams();

  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  const [modalWhatsapp, setModalWhatsapp] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'send' | 'edit'
  const [whatsappInput, setWhatsappInput] = useState('');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  const [modalContab, setModalContab] = useState(false);
  const [contabilidades, setContabilidades] = useState([]);
  const [loadingContab, setLoadingContab] = useState(false);
  const [searchContab, setSearchContab] = useState('');
  const [novaContabId, setNovaContabId] = useState(null);
  const [savingContab, setSavingContab] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/sindicato-empresas/empresas/${id}`);
      setEmpresa(res.data);
    } catch { toast.error('Erro ao carregar empresa'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function enviarMensagemWhatsapp() {
    setSendingWhatsapp(true);
    try {
      const res = await api.post('/sindicato-empresas/cobrancas', { empresa_id: id });
      window.open(res.data.whatsapp_link, '_blank');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar mensagem de WhatsApp');
    } finally { setSendingWhatsapp(false); }
  }

  function handleClickWhatsapp() {
    if (empresa.whatsapp) { enviarMensagemWhatsapp(); return; }
    setPendingAction('send');
    setWhatsappInput('');
    setModalWhatsapp(true);
  }

  function handleClickEditarWhatsapp() {
    setPendingAction('edit');
    setWhatsappInput(empresa.whatsapp || '');
    setModalWhatsapp(true);
  }

  async function handleSaveWhatsapp() {
    if (!whatsappInput.trim()) return;
    setSavingWhatsapp(true);
    try {
      const res = await api.put(`/sindicato-empresas/empresas/${id}/whatsapp`, { whatsapp: whatsappInput.trim() });
      setEmpresa(prev => ({ ...prev, whatsapp: res.data.whatsapp }));
      toast.success('WhatsApp salvo!');
      setModalWhatsapp(false);
      if (pendingAction === 'send') {
        await enviarMensagemWhatsapp();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar WhatsApp');
    } finally { setSavingWhatsapp(false); }
  }

  async function abrirModalContab() {
    setNovaContabId(null);
    setSearchContab('');
    setModalContab(true);
    setLoadingContab(true);
    try {
      const res = await api.get('/sindicato-empresas/contabilidades');
      setContabilidades(res.data);
    } catch { toast.error('Erro ao carregar contabilidades'); }
    finally { setLoadingContab(false); }
  }

  async function handleSalvarContab() {
    if (!novaContabId) return;
    setSavingContab(true);
    try {
      await api.put(`/sindicato-empresas/empresas/${id}`, { contabilidade_id: novaContabId });
      toast.success('Contabilidade atualizada!');
      setModalContab(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar contabilidade');
    } finally { setSavingContab(false); }
  }

  const contabilidadesFiltradas = contabilidades.filter(c => {
    const termo = searchContab.trim().toLowerCase();
    if (!termo) return true;
    return (c.nome_fantasia || '').toLowerCase().includes(termo) || (c.razao_social || '').toLowerCase().includes(termo);
  });

  if (loading || !empresa) return (
    <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-[#0C2D48]" /></div>
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-8">
      <div>
        <Link
          to={empresa.contabilidade_id ? `/sindicato/empresas/contabilidade/${empresa.contabilidade_id}` : '/sindicato/empresas'}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Empresas
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mt-2">
          <Building2 className="w-6 h-6 text-[#0C2D48]" />
          {empresa.nome_fantasia || empresa.razao_social}
        </h1>
        <p className="text-slate-500 text-sm mt-1">{empresa.razao_social}</p>
      </div>

      <div className="card space-y-3">
        <Info label="CNPJ" value={empresa.cnpj} />
        <Info label="CNAE" value={empresa.cnae} />
        <Info label="Endereço" value={[empresa.endereco, empresa.complemento, empresa.bairro].filter(Boolean).join(', ')} />
        <Info label="Cidade/UF" value={[empresa.cidade, empresa.estado].filter(Boolean).join('/')} />
        <Info label="CEP" value={empresa.cep} />
        <Info label="Telefone" value={empresa.telefone} />
        <Info label="Celular" value={empresa.celular} />
        <Info label="Email" value={empresa.email} />
        <Info label="Porte" value={empresa.porte} />
        <Info label="Categoria" value={empresa.categoria} />
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-slate-400">Contabilidade</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-800 font-medium text-right">{empresa.contabilidade_nome || '—'}</span>
            <button onClick={abrirModalContab} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Alterar contabilidade">
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <Info label="Status" value={empresa.status} />
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-slate-400">WhatsApp</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-800 font-medium text-right">{empresa.whatsapp || 'Não cadastrado'}</span>
            <button onClick={handleClickEditarWhatsapp} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Editar WhatsApp">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleClickWhatsapp}
        disabled={sendingWhatsapp}
        className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-3 rounded-xl transition-all duration-200 disabled:opacity-50"
      >
        {sendingWhatsapp ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
        Enviar mensagem no WhatsApp
      </button>

      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#0C2D48]" />
          <h3 className="font-bold text-slate-900">Histórico de Cobranças</h3>
        </div>
        {(!empresa.cobrancas || empresa.cobrancas.length === 0) ? (
          <div className="py-8 text-center text-slate-400 text-sm">Nenhuma mensagem enviada ainda</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {empresa.cobrancas.map(c => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800">Mensagem enviada para {c.telefone_usado}</span>
                <span className="text-slate-400 text-xs">{fmtDate(c.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: cadastrar/editar WhatsApp */}
      <Modal open={modalWhatsapp} onClose={() => setModalWhatsapp(false)} title={pendingAction === 'edit' ? 'Editar WhatsApp' : 'Cadastrar WhatsApp'}>
        <div className="space-y-4">
          {pendingAction === 'send' && (
            <p className="text-sm text-slate-500">Esta empresa ainda não tem um WhatsApp cadastrado. Informe o número para continuar.</p>
          )}
          <div>
            <label className="label">WhatsApp</label>
            <input
              className="input"
              value={whatsappInput}
              onChange={e => setWhatsappInput(e.target.value)}
              placeholder="64999998888"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setModalWhatsapp(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSaveWhatsapp} disabled={savingWhatsapp || !whatsappInput.trim()} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {savingWhatsapp && <Loader2 className="w-4 h-4 animate-spin" />}
              {pendingAction === 'send' ? 'Salvar e continuar' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: alterar contabilidade */}
      <Modal open={modalContab} onClose={() => setModalContab(false)} title="Alterar Contabilidade">
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input pl-9"
              placeholder="Buscar contabilidade..."
              value={searchContab}
              onChange={e => setSearchContab(e.target.value)}
            />
          </div>
          <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
            {loadingContab ? (
              <div className="py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
            ) : contabilidadesFiltradas.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">Nenhuma contabilidade encontrada</div>
            ) : contabilidadesFiltradas.map(c => (
              <button
                key={c.id}
                onClick={() => setNovaContabId(c.id)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  novaContabId === c.id ? 'bg-blue-50 text-[#0C2D48] font-semibold' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                {c.nome_fantasia || c.razao_social}
                {c.id === empresa.contabilidade_id && <span className="text-slate-400 font-normal"> (atual)</span>}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setModalContab(false)} className="btn-secondary">Cancelar</button>
            <button
              onClick={handleSalvarContab}
              disabled={savingContab || !novaContabId || novaContabId === empresa.contabilidade_id}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {savingContab && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-800 font-medium text-right">{value || '—'}</span>
    </div>
  );
}
