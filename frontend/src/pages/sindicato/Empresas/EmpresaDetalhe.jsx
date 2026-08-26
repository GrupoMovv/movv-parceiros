import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import CurrencyInput from '../../../components/ui/CurrencyInput';
import { Building2, Loader2, ArrowLeft, MessageCircle, Receipt, Clock } from 'lucide-react';

const fmt = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = d => d ? d.slice(0, 10).split('-').reverse().join('/') : '—';

const EMPTY_COBRANCA = { numero_guia: '', valor: 0, data_vencimento: '' };

export default function SindicatoEmpresaDetalhe() {
  const { id } = useParams();

  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);

  const [modalWhatsapp, setModalWhatsapp] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'chat' | 'cobranca'
  const [whatsappInput, setWhatsappInput] = useState('');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  const [modalCobranca, setModalCobranca] = useState(false);
  const [cobrancaForm, setCobrancaForm] = useState(EMPTY_COBRANCA);
  const [savingCobranca, setSavingCobranca] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/sindicato-empresas/empresas/${id}`);
      setEmpresa(res.data);
    } catch { toast.error('Erro ao carregar empresa'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function abrirChatWhatsapp(numero) {
    const digits = numero.replace(/\D/g, '');
    window.open(`https://wa.me/55${digits}`, '_blank');
  }

  function handleClickWhatsapp() {
    if (empresa.whatsapp) { abrirChatWhatsapp(empresa.whatsapp); return; }
    setPendingAction('chat');
    setWhatsappInput('');
    setModalWhatsapp(true);
  }

  function handleClickCobrarGuia() {
    if (!empresa.whatsapp) {
      setPendingAction('cobranca');
      setWhatsappInput('');
      setModalWhatsapp(true);
      return;
    }
    setCobrancaForm(EMPTY_COBRANCA);
    setModalCobranca(true);
  }

  async function handleSaveWhatsapp() {
    if (!whatsappInput.trim()) return;
    setSavingWhatsapp(true);
    try {
      const res = await api.put(`/sindicato-empresas/empresas/${id}/whatsapp`, { whatsapp: whatsappInput.trim() });
      setEmpresa(prev => ({ ...prev, whatsapp: res.data.whatsapp }));
      toast.success('WhatsApp cadastrado!');
      setModalWhatsapp(false);
      if (pendingAction === 'chat') {
        abrirChatWhatsapp(res.data.whatsapp);
      } else if (pendingAction === 'cobranca') {
        setCobrancaForm(EMPTY_COBRANCA);
        setModalCobranca(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao cadastrar WhatsApp');
    } finally { setSavingWhatsapp(false); }
  }

  async function handleSubmitCobranca() {
    setSavingCobranca(true);
    try {
      const res = await api.post('/sindicato-empresas/cobrancas', {
        empresa_id: id,
        numero_guia: cobrancaForm.numero_guia,
        valor: cobrancaForm.valor,
        data_vencimento: cobrancaForm.data_vencimento,
      });
      window.open(res.data.whatsapp_link, '_blank');
      toast.success('Cobrança registrada!');
      setModalCobranca(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar cobrança');
    } finally { setSavingCobranca(false); }
  }

  const podeSalvarCobranca = cobrancaForm.numero_guia.trim() && parseFloat(cobrancaForm.valor) > 0 && cobrancaForm.data_vencimento;

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
        <Info label="Contabilidade" value={empresa.contabilidade_nome} />
        <Info label="Status" value={empresa.status} />
        <Info label="WhatsApp" value={empresa.whatsapp || 'Não cadastrado'} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleClickWhatsapp}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-3 rounded-xl transition-all duration-200"
        >
          <MessageCircle className="w-5 h-5" /> WhatsApp
        </button>
        <button
          onClick={handleClickCobrarGuia}
          className="flex-1 flex items-center justify-center gap-2 btn-primary"
        >
          <Receipt className="w-5 h-5" /> Cobrar Guia Assistencial
        </button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#0C2D48]" />
          <h3 className="font-bold text-slate-900">Histórico de Cobranças</h3>
        </div>
        {(!empresa.cobrancas || empresa.cobrancas.length === 0) ? (
          <div className="py-8 text-center text-slate-400 text-sm">Nenhuma cobrança registrada ainda</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {empresa.cobrancas.map(c => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-slate-800">Guia {c.numero_guia}</span>
                  <p className="text-slate-400 text-xs mt-0.5">Vencimento {fmtDate(c.data_vencimento)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{fmt(c.valor)}</p>
                  <p className="text-slate-400 text-xs">{fmtDate(c.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: cadastrar WhatsApp (pré-requisito) */}
      <Modal open={modalWhatsapp} onClose={() => setModalWhatsapp(false)} title="Cadastrar WhatsApp">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Esta empresa ainda não tem um WhatsApp cadastrado. Informe o número para continuar.</p>
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
              Salvar e continuar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: cobrar guia assistencial */}
      <Modal open={modalCobranca} onClose={() => setModalCobranca(false)} title="Cobrar Guia Assistencial">
        <div className="space-y-4">
          <div>
            <label className="label">Número da Guia</label>
            <input
              className="input"
              value={cobrancaForm.numero_guia}
              onChange={e => setCobrancaForm(f => ({ ...f, numero_guia: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Valor</label>
            <CurrencyInput value={cobrancaForm.valor} onChange={v => setCobrancaForm(f => ({ ...f, valor: v }))} />
          </div>
          <div>
            <label className="label">Data de Vencimento</label>
            <input
              type="date"
              className="input"
              value={cobrancaForm.data_vencimento}
              onChange={e => setCobrancaForm(f => ({ ...f, data_vencimento: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setModalCobranca(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSubmitCobranca} disabled={savingCobranca || !podeSalvarCobranca} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50">
              {savingCobranca && <Loader2 className="w-4 h-4 animate-spin" />}
              <MessageCircle className="w-4 h-4" /> Gerar e Enviar
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
