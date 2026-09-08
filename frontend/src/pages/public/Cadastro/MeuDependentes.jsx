import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Plus, Pencil, Trash2, ExternalLink, Camera, X, Save } from 'lucide-react';
import apiPainel from '../../../services/apiPainel';
import { assetUrl } from '../../../services/api';
import { publicCarteirinhaUrl } from '../../../utils/carteirinhaWhatsapp';
import InputDataBR, { dataISOParaBR } from './InputDataBR';
import CapturaFoto from './CapturaFoto';
import AvatarPlaceholder from '../../../components/AvatarPlaceholder';

const NAVY = '#0B1F3A';
const GOLD = '#D4AF37';
const LIME = '#B8E62C';
const MAX_DEPENDENTES = 5;

const GRAUS = [
  ['conjuge', 'Cônjuge'], ['filho', 'Filho'], ['filha', 'Filha'], ['pai', 'Pai'], ['mae', 'Mãe'],
  ['irmao', 'Irmão'], ['irma', 'Irmã'], ['enteado', 'Enteado'], ['enteada', 'Enteada'], ['outro', 'Outro'],
];

function grauLabel(v) { return GRAUS.find(([k]) => k === v)?.[1] || '—'; }

function maskCpf(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export default function MeuDependentes() {
  const { dados, setDados } = useOutletContext();
  const [modal, setModal] = useState(null); // null | { editando: dep|null }
  const [capturandoId, setCapturandoId] = useState(null);
  const [enviandoFotoId, setEnviandoFotoId] = useState(null);

  const dependentes = dados.dependentes;
  const atingiuLimite = dependentes.length >= MAX_DEPENDENTES;

  async function recarregarDependentes() {
    const res = await apiPainel.get('/public/painel/me');
    setDados(res.data);
  }

  async function handleRemover(dep) {
    if (!window.confirm(`Tem certeza que quer remover ${dep.nome}? A carteirinha dele será desativada.`)) return;
    try {
      await apiPainel.delete(`/public/painel/dependentes/${dep.id}`);
      toast.success('Dependente removido');
      recarregarDependentes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao remover dependente');
    }
  }

  async function handleFoto(dep, captura) {
    if (!captura) return;
    setEnviandoFotoId(dep.id);
    try {
      const fd = new FormData();
      fd.append('foto', captura.blob, 'foto.jpg');
      await apiPainel.post(`/public/painel/dependentes/${dep.id}/foto`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setCapturandoId(null);
      toast.success('Foto atualizada!');
      recarregarDependentes();
    } catch {
      toast.error('Erro ao enviar foto');
    } finally {
      setEnviandoFotoId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: NAVY }}>Dependentes</h1>
          <p className="text-slate-400 text-xs mt-1">{dependentes.length}/{MAX_DEPENDENTES} cadastrados</p>
        </div>
        <button
          type="button"
          onClick={() => !atingiuLimite && setModal({ editando: null })}
          disabled={atingiuLimite}
          title={atingiuLimite ? `Limite de ${MAX_DEPENDENTES} dependentes atingido` : undefined}
          className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl text-white disabled:opacity-40"
          style={{ backgroundColor: NAVY }}
        >
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>

      {dependentes.length === 0 && (
        <p className="text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-100 py-10">
          Nenhum dependente cadastrado ainda.
        </p>
      )}

      <div className="space-y-2.5">
        {dependentes.map(dep => (
          <div key={dep.id} className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className="flex items-start gap-3">
              {dep.foto_url ? (
                <img src={assetUrl(dep.foto_url)} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${GOLD}` }} />
              ) : (
                <AvatarPlaceholder nome={dep.nome} size={56} />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 truncate">{dep.nome}</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {grauLabel(dep.grau)}{dep.data_nascimento ? ` · ${dataISOParaBR(dep.data_nascimento)}` : ''}
                </p>
                {dep.cpf && <p className="text-slate-400 text-xs">CPF {maskCpf(dep.cpf)}</p>}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {dep.carteirinha_hash && (
                <a href={publicCarteirinhaUrl(dep.carteirinha_hash)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> Ver carteirinha
                </a>
              )}
              <button type="button" onClick={() => setCapturandoId(v => v === dep.id ? null : dep.id)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                <Camera className="w-3.5 h-3.5" /> Foto
              </button>
              <button type="button" onClick={() => setModal({ editando: dep })} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
              <button type="button" onClick={() => handleRemover(dep)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 transition-colors ml-auto">
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            </div>

            {capturandoId === dep.id && (
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                <CapturaFoto onCapturar={captura => handleFoto(dep, captura)} />
                {enviandoFotoId === dep.id && <p className="text-center text-slate-400 text-xs flex items-center justify-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <ModalDependente
          editando={modal.editando}
          onClose={() => setModal(null)}
          onSalvo={() => { setModal(null); recarregarDependentes(); }}
        />
      )}
    </div>
  );
}

function ModalDependente({ editando, onClose, onSalvo }) {
  const [nome, setNome] = useState(editando?.nome || '');
  const [cpf, setCpf] = useState(maskCpf(editando?.cpf || ''));
  const [dataNascimento, setDataNascimento] = useState(editando?.data_nascimento || '');
  const [grau, setGrau] = useState(editando?.grau || '');
  const [salvando, setSalvando] = useState(false);

  async function handleSalvar() {
    const nomeTrim = nome.trim();
    if (!nomeTrim) return toast.error('Nome é obrigatório');
    setSalvando(true);
    try {
      const payload = { nome: nomeTrim, cpf: cpf.replace(/\D/g, '') || null, data_nascimento: dataNascimento || null, grau: grau || null };
      if (editando) {
        await apiPainel.put(`/public/painel/dependentes/${editando.id}`, payload);
        toast.success('Dependente atualizado!');
      } else {
        await apiPainel.post('/public/painel/dependentes/adicionar', payload);
        toast.success('Dependente adicionado!');
      }
      onSalvo();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar dependente');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(11,31,58,0.6)' }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm" style={{ color: NAVY }}>{editando ? 'Editar dependente' : 'Adicionar dependente'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        <Campo label="Nome completo"><input type="text" className="input" value={nome} onChange={e => setNome(e.target.value)} autoFocus /></Campo>
        <Campo label="CPF (opcional)"><input type="text" inputMode="numeric" className="input" value={cpf} onChange={e => setCpf(maskCpf(e.target.value))} /></Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Nascimento">
            <InputDataBR valueISO={dataNascimento} onChangeISO={setDataNascimento} />
          </Campo>
          <Campo label="Parentesco">
            <select className="input" value={grau} onChange={e => setGrau(e.target.value)}>
              <option value="">Selecione</option>
              {GRAUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Campo>
        </div>

        <button
          onClick={handleSalvar} disabled={salvando}
          className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: LIME, color: NAVY }}
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
        </button>
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
