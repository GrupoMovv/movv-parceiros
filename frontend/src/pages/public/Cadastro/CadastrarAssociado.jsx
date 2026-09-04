import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ArrowRight, Loader2, CheckCircle2, XCircle, AlertTriangle,
  PartyPopper, ExternalLink, LayoutDashboard,
  Users2, Plus, Trash2, ShieldCheck,
} from 'lucide-react';
import api, { assetUrl } from '../../../services/api';
import { setPainelToken } from '../../../services/apiPainel';
import { publicCarteirinhaUrl } from '../../../utils/carteirinhaWhatsapp';
import CapturaFoto from './CapturaFoto';
import Confete from './Confete';
import InputDataBR from './InputDataBR';

const NAVY = '#0B1F3A';
const GOLD = '#D4AF37';
const LIME = '#B8E62C';
const GRAUS = [['conjuge', 'Cônjuge'], ['filho', 'Filho'], ['filha', 'Filha']];

function maskCPF(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskCNPJ(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function maskPhone(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function novaChave() { return `novo${Date.now()}${Math.random()}`; }

export default function CadastrarAssociado() {
  const navigate = useNavigate();
  const [step, setStep] = useState('qualificacao');

  // Tela 2 — validação
  const [cpf, setCpf] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [validando, setValidando] = useState(false);
  const [erroValidacao, setErroValidacao] = useState(null);
  const [jaAtivado, setJaAtivado] = useState(false);
  const [registro, setRegistro] = useState(null);

  // Tela 4 — completar cadastro
  const [dataNascISO, setDataNascISO] = useState(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [foto, setFoto] = useState(null);
  const [mostrarDependentes, setMostrarDependentes] = useState(false);
  const [dependentes, setDependentes] = useState([]);
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [resultado, setResultado] = useState(null);

  async function handleValidar() {
    const cpfDigits = cpf.replace(/\D/g, '');
    const cnpjDigits = cnpj.replace(/\D/g, '');
    if (cpfDigits.length !== 11 || cnpjDigits.length !== 14) {
      setErroValidacao('Preencha o CPF e o CNPJ completos');
      return;
    }
    setValidando(true);
    setErroValidacao(null);
    setJaAtivado(false);
    try {
      const res = await api.post('/public/cadastrar-associado/verificar', { cpf: cpfDigits, cnpj: cnpjDigits });
      setRegistro(res.data);
      setStep('confirmacao');
    } catch (err) {
      setJaAtivado(Boolean(err.response?.data?.ja_ativado));
      setErroValidacao(err.response?.data?.error || 'Erro ao validar seus dados. Tente novamente.');
    } finally {
      setValidando(false);
    }
  }

  function addDependente() {
    if (dependentes.length >= 6) return;
    setDependentes(d => [...d, { _key: novaChave(), nome: '', grau: '', data_nascimento: '' }]);
  }
  function updateDependente(idx, campo, valor) {
    setDependentes(d => d.map((dep, i) => i === idx ? { ...dep, [campo]: valor } : dep));
  }
  function removeDependente(idx) {
    setDependentes(d => d.filter((_, i) => i !== idx));
  }

  const whatsappValido = whatsapp.replace(/\D/g, '').length >= 10;
  const podeAtivar = Boolean(dataNascISO) && whatsappValido && Boolean(foto) && termosAceitos && !enviando;

  async function handleAtivar() {
    if (!podeAtivar) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('lista_id', registro.lista_id);
      fd.append('data_nascimento', dataNascISO);
      fd.append('whatsapp', whatsapp.replace(/\D/g, ''));
      if (email.trim()) fd.append('email', email.trim());
      if (cidade.trim()) fd.append('cidade', cidade.trim());
      if (estado.trim()) fd.append('estado', estado.trim());
      fd.append('dependentes', JSON.stringify(dependentes.filter(d => d.nome.trim())));
      fd.append('aceite_termos', 'true');
      fd.append('foto', foto.blob, 'foto.jpg');

      const res = await api.post('/public/cadastrar-associado/completar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPainelToken(res.data.token);
      setResultado(res.data);
      setStep('final');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao ativar sua carteirinha. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  // ── Tela 5 — sucesso ──────────────────────────────────────────────────
  if (step === 'final' && resultado) {
    const urlCarteirinha = publicCarteirinhaUrl(resultado.carteirinha_hash);
    return (
      <PageShell>
        <Confete />
        <div className="w-full max-w-[420px] bg-white rounded-[2rem] p-8 text-center space-y-5 shadow-2xl">
          <PartyPopper className="w-14 h-14 mx-auto" style={{ color: GOLD }} />
          <div>
            <h1 className="text-2xl font-black text-slate-900">Sua carteirinha está ativa!</h1>
            <p className="text-slate-500 text-sm mt-1">Bem-vindo(a) ao SECI + IUB MAIS, {resultado.nome_completo.trim().split(/\s+/)[0]}!</p>
          </div>

          {resultado.foto_url && (
            <img src={assetUrl(resultado.foto_url)} alt="" className="w-24 h-24 rounded-full object-cover mx-auto border-4" style={{ borderColor: GOLD }} />
          )}

          {resultado.matricula_interna && (
            <p className="text-xs text-slate-400">Matrícula: <span className="font-semibold text-slate-600">{resultado.matricula_interna}</span></p>
          )}

          <div className="space-y-2.5">
            <a href={urlCarteirinha} target="_blank" rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3.5 rounded-xl transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: NAVY, color: 'white' }}>
              <ExternalLink className="w-4 h-4" /> Ver minha carteirinha completa
            </a>
            <button
              onClick={() => navigate(`/marketplace?associado=${resultado.carteirinha_hash}`)}
              className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3.5 rounded-xl transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: LIME, color: NAVY }}
            >
              Ir pro IUB MAIS
            </button>
            <Link to="/meu-painel"
              className="w-full flex items-center justify-center gap-2 font-semibold text-sm py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
              <Users2 className="w-4 h-4" /> Adicionar dependentes
            </Link>
          </div>

          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
            <LayoutDashboard className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-amber-700 text-xs">
              <strong>Salve o link da sua carteirinha</strong> no WhatsApp ou nos favoritos do celular — é seu acesso rápido sempre que precisar.
            </p>
          </div>

          <Link to="/" className="text-slate-400 text-xs underline">Voltar ao início</Link>
        </div>
      </PageShell>
    );
  }

  // ── Tela 1 — qualificação ─────────────────────────────────────────────
  if (step === 'qualificacao') {
    return (
      <PageShell>
        <div className="w-full max-w-[560px]">
          <div className="text-center mb-6">
            <p className="text-white font-black text-2xl tracking-wide">SECI + IUB MAIS</p>
            <h1 className="text-white text-xl font-bold mt-3">Fazer minha carteirinha SECI + IUB MAIS</h1>
            <p className="text-white/60 text-sm mt-1.5">Você é colaborador de uma empresa parceira do SECI?</p>
          </div>

          <div className="space-y-3">
            <OpcaoQualificacao
              emoji="🏢" titulo="Sim, minha empresa é parceira"
              texto="Ex.: Reis, Frimesa, Grupo Andrade"
              botao="Continuar" cor={LIME}
              onClick={() => setStep('validacao')}
            />
            <OpcaoQualificacao
              emoji="🤔" titulo="Não sei se minha empresa é parceira"
              texto="Vamos verificar com seu CPF e o CNPJ da empresa"
              botao="Verificar" cor={GOLD}
              onClick={() => setStep('validacao')}
            />
            <OpcaoQualificacao
              emoji="🚀" titulo="Quero ser associado individual"
              texto="Sem vínculo com empresa parceira"
              botao="Continuar" cor="white"
              onClick={() => navigate('/cadastrar')}
            />
          </div>
        </div>
      </PageShell>
    );
  }

  // ── Tela 2 — validação CPF + CNPJ ─────────────────────────────────────
  if (step === 'validacao') {
    return (
      <PageShell>
        <div className="w-full max-w-[420px] bg-white rounded-[2rem] p-8 shadow-2xl space-y-5">
          <BotaoVoltar onClick={() => { setStep('qualificacao'); setErroValidacao(null); }} />
          <div>
            <h1 className="text-xl font-black text-slate-900">Vamos validar seus dados</h1>
            <p className="text-slate-500 text-sm mt-1">Confira se seu nome está na lista de colaboradores aprovados da sua empresa.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">CPF</label>
            <input className="input" placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(maskCPF(e.target.value))} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">CNPJ da sua empresa</label>
            <input className="input" placeholder="00.000.000/0000-00" value={cnpj} onChange={e => setCnpj(maskCNPJ(e.target.value))} />
            <p className="text-slate-400 text-[11px] mt-1">Não sabe o CNPJ? Peça ao RH da sua empresa.</p>
          </div>

          {erroValidacao && (
            <div className="flex items-start gap-2.5 border rounded-xl p-3 text-sm bg-red-50 border-red-200 text-red-700">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p>{erroValidacao}</p>
                {jaAtivado && (
                  <Link to="/marketplace" className="inline-block mt-1.5 font-semibold underline">Ir pro Marketplace e fazer login</Link>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleValidar}
            disabled={validando}
            className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: LIME, color: NAVY }}
          >
            {validando ? <Loader2 className="w-5 h-5 animate-spin" /> : null} Validar
          </button>

          <p className="text-center text-xs text-slate-400">
            Não tem empresa parceira? <Link to="/cadastrar" className="underline font-semibold">Vire associado individual</Link>
          </p>
        </div>
      </PageShell>
    );
  }

  // ── Tela 3 — confirmação dos dados ────────────────────────────────────
  if (step === 'confirmacao' && registro) {
    return (
      <PageShell>
        <div className="w-full max-w-[420px] bg-white rounded-[2rem] p-8 shadow-2xl space-y-5">
          <BotaoVoltar onClick={() => setStep('validacao')} />
          <div className="text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
            <h1 className="text-xl font-black text-slate-900 mt-2">Encontramos você!</h1>
            <p className="text-slate-500 text-sm mt-1">Confirme se os dados abaixo estão certos:</p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 text-sm">
            <CampoReadonly label="Nome" valor={registro.nome} />
            <CampoReadonly label="CPF" valor={maskCPF(registro.cpf)} />
            <CampoReadonly label="Empresa" valor={registro.razao_social_empresa} />
            {registro.matricula_interna && <CampoReadonly label="Matrícula" valor={registro.matricula_interna} />}
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => setStep('completar')}
              className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              style={{ backgroundColor: LIME, color: NAVY }}
            >
              Sim, sou eu! Continuar cadastro
            </button>
            <button
              onClick={() => setStep('contestacao')}
              className="w-full py-3 rounded-xl font-semibold text-sm border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Não sou eu / dados diferentes
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── Contestação ───────────────────────────────────────────────────────
  if (step === 'contestacao') {
    return (
      <TelaMensagem
        icon={<AlertTriangle className="w-14 h-14" style={{ color: GOLD }} />}
        titulo="Dados incorretos?"
        texto="Fale com o RH da sua empresa ou com o Sindicato pra corrigir seu cadastro na lista antes de ativar a carteirinha."
      />
    );
  }

  // ── Tela 4 — completar cadastro ───────────────────────────────────────
  if (step === 'completar' && registro) {
    return (
      <PageShell>
        <div className="w-full max-w-[460px] bg-white rounded-[2rem] p-8 shadow-2xl space-y-5">
          <BotaoVoltar onClick={() => setStep('confirmacao')} />
          <div>
            <h1 className="text-xl font-black text-slate-900">Só faltam alguns dados</h1>
            <p className="text-slate-500 text-sm mt-1">Pra ativar sua carteirinha na hora.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Data de nascimento</label>
            <InputDataBR valueISO={null} onChangeISO={setDataNascISO} idadeMinima={14} idadeMaxima={100} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">WhatsApp</label>
            <input className="input" placeholder="(00) 00000-0000" value={whatsapp} onChange={e => setWhatsapp(maskPhone(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">E-mail (opcional)</label>
            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Cidade (opcional)</label>
              <input className="input" value={cidade} onChange={e => setCidade(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Estado (opcional)</label>
              <input className="input uppercase" maxLength={2} value={estado} onChange={e => setEstado(e.target.value.toUpperCase())} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Foto (obrigatória)</label>
            <CapturaFoto onCapturar={setFoto} fotoAtual={foto} />
          </div>

          <div>
            {!mostrarDependentes ? (
              <button onClick={() => setMostrarDependentes(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm hover:border-slate-400 transition-colors">
                <Users2 className="w-4 h-4" /> Incluir dependentes agora? (opcional)
              </button>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-slate-500">Dependentes</p>
                {dependentes.map((dep, idx) => (
                  <div key={dep._key} className="border border-slate-200 rounded-xl p-3 space-y-2 relative">
                    <button onClick={() => removeDependente(idx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <input type="text" placeholder="Nome" className="input" value={dep.nome} onChange={e => updateDependente(idx, 'nome', e.target.value)} />
                    <div className="grid grid-cols-2 gap-2">
                      <select className="input" value={dep.grau} onChange={e => updateDependente(idx, 'grau', e.target.value)}>
                        <option value="">Grau</option>
                        {GRAUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <InputDataBR valueISO={dep.data_nascimento} onChangeISO={iso => updateDependente(idx, 'data_nascimento', iso || '')} />
                    </div>
                  </div>
                ))}
                {dependentes.length < 6 && (
                  <button onClick={addDependente} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs hover:border-slate-400 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Adicionar dependente
                  </button>
                )}
                <p className="text-slate-400 text-[11px]">Pode adicionar/editar depois em "Meu Painel", sem pressa.</p>
              </div>
            )}
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer border-t border-slate-100 pt-4">
            <input type="checkbox" checked={termosAceitos} onChange={e => setTermosAceitos(e.target.checked)} className="mt-0.5 w-4 h-4" style={{ accentColor: NAVY }} />
            <span className="text-slate-600 text-xs flex items-start gap-1"><ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" /> Li e aceito os termos e o regulamento do SECI, e autorizo o uso dos meus dados pra emissão da carteirinha</span>
          </label>

          <button
            onClick={handleAtivar}
            disabled={!podeAtivar}
            className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2 transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: LIME, color: NAVY }}
          >
            {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <PartyPopper className="w-5 h-5" />}
            Ativar minha carteirinha
          </button>
        </div>
      </PageShell>
    );
  }

  return null;
}

// ── Subcomponentes ────────────────────────────────────────────────────────

function PageShell({ children }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 py-10" style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #111111 100%)` }}>
      {children}
    </div>
  );
}

function TelaMensagem({ icon, titulo, texto }) {
  return (
    <PageShell>
      <div className="w-full max-w-[380px] bg-white rounded-[2rem] shadow-2xl p-8 text-center space-y-3">
        {icon}
        <h1 className="text-xl font-bold text-slate-900">{titulo}</h1>
        <p className="text-slate-500 text-sm">{texto}</p>
        <Link to="/" className="inline-block text-slate-400 text-xs underline mt-2">Voltar ao início</Link>
      </div>
    </PageShell>
  );
}

function BotaoVoltar({ onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-xs font-medium transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" /> Voltar
    </button>
  );
}

function CampoReadonly({ label, valor }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-900 text-right">{valor}</span>
    </div>
  );
}

function OpcaoQualificacao({ emoji, titulo, texto, botao, cor, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl p-5 flex items-center gap-4 text-left hover:scale-[1.01] transition-transform shadow-xl"
    >
      <span className="text-3xl flex-shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900">{titulo}</p>
        <p className="text-slate-500 text-xs mt-0.5">{texto}</p>
      </div>
      <span className="flex-shrink-0 flex items-center gap-1 text-xs font-black uppercase px-3 py-2 rounded-lg" style={{ backgroundColor: cor, color: NAVY }}>
        {botao} <ArrowRight className="w-3 h-3" />
      </span>
    </button>
  );
}
