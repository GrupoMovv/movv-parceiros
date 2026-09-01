import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Loader2, ArrowLeft, CreditCard, Users2, Camera, Pencil, Gift,
  ExternalLink, MessageCircle, Plus, Trash2, Save, LogOut, CheckCircle2,
} from 'lucide-react';
import apiPainel, { getPainelToken, setPainelToken } from '../../../services/apiPainel';
import { assetUrl } from '../../../services/api';
import {
  publicCarteirinhaUrl, publicBeneficiosPdfUrl, montarMensagemCadastroPublico, linkWhatsappComTexto,
} from '../../../utils/carteirinhaWhatsapp';
import CapturaFoto from './CapturaFoto';
import InputDataBR from './InputDataBR';

const NAVY = '#0B1F3A';
const GOLD = '#D4AF37';
const LIME = '#B8E62C';
const GRAUS = [['conjuge', 'Cônjuge'], ['filho', 'Filho'], ['filha', 'Filha']];

function iniciais(nome) {
  return String(nome || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

export default function MeuPainel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState(null);
  const [view, setView] = useState('home'); // home | dados | foto | dependentes

  const carregar = useCallback(async () => {
    if (!getPainelToken()) { navigate('/cadastrar'); return; }
    try {
      const res = await apiPainel.get('/public/painel/me');
      setDados(res.data);
    } catch {
      setPainelToken(null);
      toast.error('Sessão expirada — faça login de novo');
      navigate('/cadastrar');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { carregar(); }, [carregar]);

  function handleSair() {
    setPainelToken(null);
    navigate('/cadastrar');
  }

  if (loading || !dados) {
    return (
      <PageShell>
        <Loader2 className="w-8 h-8 animate-spin text-white/60" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-6">
          <p className="text-white font-black text-2xl tracking-wide">SECI</p>
          <p className="text-white/60 text-sm mt-1">Meu Painel</p>
        </div>

        <div className="bg-white rounded-[2rem] p-6 sm:p-7 shadow-2xl space-y-5">
          {view !== 'home' && (
            <button onClick={() => setView('home')} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-xs font-medium transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao painel
            </button>
          )}

          {view === 'home' && <Home dados={dados} onNavegar={setView} />}
          {view === 'dados' && <EditarDados dados={dados} onSalvo={d => { setDados(d); setView('home'); }} />}
          {view === 'foto' && <TrocarFoto dados={dados} onSalvo={d => setDados(d)} />}
          {view === 'dependentes' && <Dependentes dados={dados} onSalvo={d => setDados(d)} />}

          {view === 'home' && (
            <button onClick={handleSair} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 text-xs font-medium transition-colors pt-2">
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function Home({ dados, onNavegar }) {
  const [reenviando, setReenviando] = useState(false);

  async function handleReenviar() {
    setReenviando(true);
    try {
      const res = await apiPainel.post('/public/painel/reenviar-carteirinha');
      const nomeCurto = res.data.nome_completo.trim().split(/\s+/)[0];
      const urlTitular = publicCarteirinhaUrl(res.data.carteirinha_hash);
      const urlPainel = `${window.location.origin}/cadastrar`;
      const mensagem = montarMensagemCadastroPublico(urlTitular, urlPainel);
      if (!res.data.whatsapp) {
        toast.error('Cadastre seu WhatsApp em "Editar dados" antes de reenviar');
        return;
      }
      window.open(linkWhatsappComTexto(res.data.whatsapp, mensagem), '_blank');
    } catch {
      toast.error('Erro ao reenviar carteirinha');
    } finally {
      setReenviando(false);
    }
  }

  return (
    <div className="space-y-5">
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
          <p className="text-slate-400 text-xs">{dados.empresa}</p>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${dados.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            <CheckCircle2 className="w-2.5 h-2.5" /> {dados.ativo ? 'ATIVO' : 'INATIVO'}
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        <CardAcao icon={<CreditCard className="w-4 h-4" />} titulo="Minha Carteirinha" sub="Ver ou reenviar pelo WhatsApp">
          <div className="flex gap-2 mt-2">
            <a href={publicCarteirinhaUrl(dados.carteirinha_hash)} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> Ver
            </a>
            <button onClick={handleReenviar} disabled={reenviando} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg text-white transition-colors disabled:opacity-50" style={{ backgroundColor: '#25D366' }}>
              {reenviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />} Reenviar
            </button>
          </div>
        </CardAcao>

        <button onClick={() => onNavegar('dependentes')} className="w-full text-left">
          <CardAcao icon={<Users2 className="w-4 h-4" />} titulo={`Dependentes (${dados.dependentes.length})`} sub="Gerenciar dependentes e fotos" />
        </button>

        <button onClick={() => onNavegar('foto')} className="w-full text-left">
          <CardAcao icon={<Camera className="w-4 h-4" />} titulo="Trocar minha foto" sub="Tirar uma nova foto pela câmera" />
        </button>

        <button onClick={() => onNavegar('dados')} className="w-full text-left">
          <CardAcao icon={<Pencil className="w-4 h-4" />} titulo="Editar dados" sub="WhatsApp, e-mail, cidade e estado" />
        </button>

        <a href={publicBeneficiosPdfUrl()} target="_blank" rel="noreferrer" className="block">
          <CardAcao icon={<Gift className="w-4 h-4" />} titulo="Ver benefícios" sub="Catálogo completo em PDF" />
        </a>
      </div>
    </div>
  );
}

function CardAcao({ icon, titulo, sub, children }) {
  return (
    <div className="border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FDF8ED', color: GOLD }}>{icon}</span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 text-sm">{titulo}</p>
          <p className="text-slate-400 text-xs">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function EditarDados({ dados, onSalvo }) {
  const [whatsapp, setWhatsapp] = useState(dados.whatsapp || '');
  const [email, setEmail] = useState(dados.email || '');
  const [cidade, setCidade] = useState(dados.cidade || '');
  const [estado, setEstado] = useState(dados.estado || '');
  const [salvando, setSalvando] = useState(false);

  async function handleSalvar() {
    setSalvando(true);
    try {
      const res = await apiPainel.put('/public/painel/me', { whatsapp, email, cidade, estado });
      toast.success('Dados atualizados!');
      onSalvo(res.data);
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-slate-900 font-bold text-sm">Editar dados</h2>
      <Campo label="WhatsApp"><input type="text" className="input" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} /></Campo>
      <Campo label="E-mail"><input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} /></Campo>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Cidade"><input type="text" className="input" value={cidade} onChange={e => setCidade(e.target.value)} /></Campo>
        <Campo label="Estado"><input type="text" maxLength={2} className="input uppercase" value={estado} onChange={e => setEstado(e.target.value.toUpperCase())} /></Campo>
      </div>
      <button onClick={handleSalvar} disabled={salvando} className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2" style={{ backgroundColor: LIME, color: NAVY }}>
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
      </button>
    </div>
  );
}

function TrocarFoto({ dados, onSalvo }) {
  const [enviando, setEnviando] = useState(false);

  async function handleCapturar(captura) {
    if (!captura) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('foto', captura.blob, 'foto.jpg');
      const res = await apiPainel.post('/public/painel/foto', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSalvo(d => ({ ...d, foto_url: res.data.foto_url }));
      toast.success('Foto atualizada!');
    } catch {
      toast.error('Erro ao enviar foto');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-slate-900 font-bold text-sm">Trocar minha foto</h2>
      <CapturaFoto onCapturar={handleCapturar} />
      {enviando && <p className="text-center text-slate-400 text-xs flex items-center justify-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</p>}
    </div>
  );
}

function Dependentes({ dados, onSalvo }) {
  const [lista, setLista] = useState(dados.dependentes.map(d => ({ ...d, _key: `d${d.id}` })));
  const [salvando, setSalvando] = useState(false);
  const [capturandoIdx, setCapturandoIdx] = useState(null);
  const [enviandoFotoIdx, setEnviandoFotoIdx] = useState(null);

  // _key é estável por linha (nunca muda) mesmo quando outra linha é
  // removida — index como key faria o InputDataBR de baixo "herdar" o
  // estado de digitação da linha que ocupava aquela posição antes.
  function addDependente() {
    if (lista.length >= 6) return;
    setLista(l => [...l, { id: null, nome: '', grau: '', data_nascimento: '', foto_url: null, _key: `novo${Date.now()}` }]);
  }
  function update(idx, campo, valor) {
    setLista(l => l.map((d, i) => i === idx ? { ...d, [campo]: valor } : d));
  }
  function remove(idx) {
    setLista(l => l.filter((_, i) => i !== idx));
  }

  async function handleSalvar() {
    setSalvando(true);
    try {
      const res = await apiPainel.post('/public/painel/dependentes', {
        dependentes: lista.filter(d => d.nome.trim()).map(d => ({ nome: d.nome, grau: d.grau || undefined, data_nascimento: d.data_nascimento || undefined })),
      });
      setLista(res.data.map(d => ({ ...d, _key: `d${d.id}` })));
      onSalvo(d => ({ ...d, dependentes: res.data }));
      toast.success('Dependentes atualizados!');
    } catch {
      toast.error('Erro ao salvar dependentes');
    } finally {
      setSalvando(false);
    }
  }

  async function handleFoto(idx, captura) {
    if (!captura) return;
    const dep = lista[idx];
    if (!dep.id) { toast.error('Salve as alterações antes de adicionar a foto deste dependente'); return; }
    setEnviandoFotoIdx(idx);
    try {
      const fd = new FormData();
      fd.append('foto', captura.blob, 'foto.jpg');
      const res = await apiPainel.post(`/public/painel/dependentes/${dep.id}/foto`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setLista(l => l.map((d, i) => i === idx ? { ...d, foto_url: res.data.foto_url } : d));
      setCapturandoIdx(null);
      toast.success('Foto atualizada!');
    } catch {
      toast.error('Erro ao enviar foto');
    } finally {
      setEnviandoFotoIdx(null);
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-slate-900 font-bold text-sm">Dependentes</h2>

      {lista.map((dep, idx) => (
        <div key={dep._key} className="border border-slate-200 rounded-xl p-3 space-y-2 relative">
          <button onClick={() => remove(idx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors">
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
              <input type="text" placeholder="Nome" className="input text-sm py-1.5" value={dep.nome} onChange={e => update(idx, 'nome', e.target.value)} />
              <div className="grid grid-cols-2 gap-1.5">
                <select className="input text-xs py-1.5" value={dep.grau || ''} onChange={e => update(idx, 'grau', e.target.value)}>
                  <option value="">Grau</option>
                  {GRAUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <InputDataBR className="input text-xs py-1.5" valueISO={dep.data_nascimento} onChangeISO={iso => update(idx, 'data_nascimento', iso)} />
              </div>
            </div>
          </div>

          {capturandoIdx === idx ? (
            <div className="space-y-2 pt-1">
              <CapturaFoto onCapturar={captura => handleFoto(idx, captura)} />
              {enviandoFotoIdx === idx && <p className="text-center text-slate-400 text-xs flex items-center justify-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</p>}
              <button onClick={() => setCapturandoIdx(null)} className="w-full text-slate-400 text-xs underline">Cancelar</button>
            </div>
          ) : (
            <button
              onClick={() => dep.id ? setCapturandoIdx(idx) : toast.error('Salve as alterações antes de adicionar a foto')}
              className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${dep.id ? 'border border-slate-200 text-slate-600 hover:bg-slate-50' : 'border border-dashed border-slate-200 text-slate-300'}`}
            >
              <Camera className="w-3.5 h-3.5" /> {dep.foto_url ? 'Trocar foto' : 'Adicionar foto'}
            </button>
          )}
        </div>
      ))}

      {lista.length < 6 && (
        <button onClick={addDependente} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm hover:border-movv-900/40 transition-colors">
          <Plus className="w-4 h-4" /> Adicionar novo dependente
        </button>
      )}

      <button onClick={handleSalvar} disabled={salvando} className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2" style={{ backgroundColor: LIME, color: NAVY }}>
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar alterações
      </button>
    </div>
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
