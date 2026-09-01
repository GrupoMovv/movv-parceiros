import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Loader2, AlertCircle, Camera, Plus, Trash2, Save, ExternalLink,
} from 'lucide-react';
import api, { assetUrl } from '../../../services/api';
import { publicCarteirinhaUrl } from '../../../utils/carteirinhaWhatsapp';
import CapturaFoto from './CapturaFoto';
import InputDataBR from './InputDataBR';

const NAVY = '#0B1F3A';
const GOLD = '#D4AF37';
const LIME = '#B8E62C';
const GRAUS = [['conjuge', 'Cônjuge'], ['filho', 'Filho'], ['filha', 'Filha']];
const DEP_VAZIO = { id: null, nome: '', grau: '', data_nascimento: '', foto_url: null };
function novaChave() { return `novo${Date.now()}${Math.random()}`; }

function iniciais(nome) {
  return String(nome || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

export default function MeuCadastro() {
  const { edit_token } = useParams();
  const [loading, setLoading] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [dados, setDados] = useState(null);

  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [dependentes, setDependentes] = useState([]);

  const [capturandoTitular, setCapturandoTitular] = useState(false);
  const [enviandoFotoTitular, setEnviandoFotoTitular] = useState(false);
  const [capturandoDependenteIdx, setCapturandoDependenteIdx] = useState(null);
  const [enviandoFotoDependenteIdx, setEnviandoFotoDependenteIdx] = useState(null);

  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const res = await api.get(`/public/meu-cadastro/${edit_token}`);
      setDados(res.data);
      setWhatsapp(res.data.whatsapp || '');
      setEmail(res.data.email || '');
      setDependentes(res.data.dependentes.map(d => ({ ...d, _key: `d${d.id}` })));
    } catch {
      setNaoEncontrado(true);
    } finally {
      setLoading(false);
    }
  }, [edit_token]);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleTrocarFotoTitular(captura) {
    if (!captura) return;
    setEnviandoFotoTitular(true);
    try {
      const fd = new FormData();
      fd.append('foto', captura.blob, 'foto.jpg');
      const res = await api.put(`/public/meu-cadastro/${edit_token}/foto`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDados(d => ({ ...d, foto_url: res.data.foto_url }));
      setCapturandoTitular(false);
      toast.success('Foto atualizada!');
    } catch {
      toast.error('Erro ao enviar foto');
    } finally {
      setEnviandoFotoTitular(false);
    }
  }

  async function handleTrocarFotoDependente(idx, captura) {
    if (!captura) return;
    const dep = dependentes[idx];
    if (!dep.id) {
      toast.error('Salve as alterações antes de adicionar a foto deste dependente');
      return;
    }
    setEnviandoFotoDependenteIdx(idx);
    try {
      const fd = new FormData();
      fd.append('foto', captura.blob, 'foto.jpg');
      const res = await api.put(`/public/meu-cadastro/${edit_token}/dependente/${dep.id}/foto`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDependentes(ds => ds.map((d, i) => i === idx ? { ...d, foto_url: res.data.foto_url } : d));
      setCapturandoDependenteIdx(null);
      toast.success('Foto atualizada!');
    } catch {
      toast.error('Erro ao enviar foto');
    } finally {
      setEnviandoFotoDependenteIdx(null);
    }
  }

  function addDependente() {
    if (dependentes.length >= 6) return;
    setDependentes(d => [...d, { ...DEP_VAZIO, _key: novaChave() }]);
  }
  function updateDependente(idx, campo, valor) {
    setDependentes(d => d.map((dep, i) => i === idx ? { ...dep, [campo]: valor } : dep));
  }
  function removeDependente(idx) {
    setDependentes(d => d.filter((_, i) => i !== idx));
  }

  async function handleSalvar() {
    setSalvando(true);
    try {
      await api.put(`/public/meu-cadastro/${edit_token}`, {
        whatsapp: whatsapp.replace(/\D/g, ''),
        email: email.trim() || null,
        dependentes: dependentes.filter(d => d.nome.trim()).map(d => ({ nome: d.nome, grau: d.grau || undefined, data_nascimento: d.data_nascimento || undefined })),
      });
      toast.success('Alterações salvas!');
      await carregar();
    } catch {
      toast.error('Erro ao salvar alterações');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <Loader2 className="w-8 h-8 animate-spin text-white/60" />
      </PageShell>
    );
  }

  if (naoEncontrado || !dados) {
    return (
      <PageShell>
        <div className="w-full max-w-[380px] bg-white rounded-[2rem] shadow-2xl p-8 text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <h1 className="text-lg font-bold text-slate-800">Link inválido</h1>
          <p className="text-slate-500 text-sm">Confira se o link está correto ou procure o Sindicato.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-6">
          <p className="text-white font-black text-2xl tracking-wide">SECI</p>
          <p className="text-white/60 text-sm mt-1">Meu Cadastro</p>
        </div>

        <div className="bg-white rounded-[2rem] p-6 sm:p-7 shadow-2xl space-y-6">
          {/* Foto + identificação */}
          <div className="flex items-center gap-4">
            {dados.foto_url ? (
              <img src={assetUrl(dados.foto_url)} alt="" className="w-20 h-20 rounded-full object-cover border-4 flex-shrink-0" style={{ borderColor: GOLD }} />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0" style={{ backgroundColor: NAVY }}>
                {iniciais(dados.nome_completo)}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-slate-900 truncate">{dados.nome_completo}</p>
              <p className="text-slate-400 text-xs">CPF {dados.cpf_parcial}</p>
              <p className="text-slate-400 text-xs">{dados.categoria_profissional} · {dados.empresa}</p>
            </div>
          </div>

          {capturandoTitular ? (
            <div className="space-y-2">
              <CapturaFoto onCapturar={handleTrocarFotoTitular} />
              {enviandoFotoTitular && <p className="text-center text-slate-400 text-xs flex items-center justify-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</p>}
              <button onClick={() => setCapturandoTitular(false)} className="w-full text-slate-400 text-xs underline">Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setCapturandoTitular(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
              <Camera className="w-4 h-4" /> Trocar minha foto
            </button>
          )}

          {dados.carteirinha_hash && (
            <a href={publicCarteirinhaUrl(dados.carteirinha_hash)} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 text-sm font-semibold py-2 text-movv-900 underline">
              <ExternalLink className="w-3.5 h-3.5" /> Ver minha carteirinha
            </a>
          )}

          <hr className="border-slate-100" />

          {/* Contato */}
          <div className="space-y-3">
            <h2 className="text-slate-900 font-bold text-sm">Contato</h2>
            <Campo label="WhatsApp">
              <input type="text" className="input" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
            </Campo>
            <Campo label="E-mail">
              <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} />
            </Campo>
          </div>

          <hr className="border-slate-100" />

          {/* Dependentes */}
          <div className="space-y-3">
            <h2 className="text-slate-900 font-bold text-sm">Dependentes</h2>

            {dependentes.map((dep, idx) => (
              <div key={dep._key} className="border border-slate-200 rounded-xl p-3 space-y-2 relative">
                <button onClick={() => removeDependente(idx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-3">
                  {dep.foto_url ? (
                    <img src={assetUrl(dep.foto_url)} alt="" className="w-12 h-12 rounded-full object-cover border-2 flex-shrink-0" style={{ borderColor: GOLD }} />
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: NAVY }}>
                      {iniciais(dep.nome) || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <input type="text" placeholder="Nome" className="input text-sm py-1.5" value={dep.nome} onChange={e => updateDependente(idx, 'nome', e.target.value)} />
                    <div className="grid grid-cols-2 gap-1.5">
                      <select className="input text-xs py-1.5" value={dep.grau || ''} onChange={e => updateDependente(idx, 'grau', e.target.value)}>
                        <option value="">Grau</option>
                        {GRAUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <InputDataBR className="input text-xs py-1.5" valueISO={dep.data_nascimento} onChangeISO={iso => updateDependente(idx, 'data_nascimento', iso)} />
                    </div>
                  </div>
                </div>

                {capturandoDependenteIdx === idx ? (
                  <div className="space-y-2 pt-1">
                    <CapturaFoto onCapturar={captura => handleTrocarFotoDependente(idx, captura)} />
                    {enviandoFotoDependenteIdx === idx && <p className="text-center text-slate-400 text-xs flex items-center justify-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</p>}
                    <button onClick={() => setCapturandoDependenteIdx(null)} className="w-full text-slate-400 text-xs underline">Cancelar</button>
                  </div>
                ) : (
                  <button
                    onClick={() => dep.id ? setCapturandoDependenteIdx(idx) : toast.error('Salve as alterações antes de adicionar a foto')}
                    className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${dep.id ? 'border border-slate-200 text-slate-600 hover:bg-slate-50' : 'border border-dashed border-slate-200 text-slate-300'}`}
                  >
                    <Camera className="w-3.5 h-3.5" /> {dep.foto_url ? 'Trocar foto' : 'Adicionar foto'}
                  </button>
                )}
              </div>
            ))}

            {dependentes.length < 6 && (
              <button onClick={addDependente} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm hover:border-movv-900/40 transition-colors">
                <Plus className="w-4 h-4" /> Adicionar novo dependente
              </button>
            )}
          </div>

          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: LIME, color: NAVY }}
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar alterações
          </button>

          <Link to="/" className="block text-center text-slate-400 text-xs underline">Voltar ao início</Link>
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 py-10" style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #111111 100%)` }}>
      {children}
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
