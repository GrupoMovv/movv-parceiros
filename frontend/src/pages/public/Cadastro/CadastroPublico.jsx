import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ArrowRight, CheckCircle2, XCircle, AlertTriangle, Loader2,
  Plus, Trash2, PartyPopper, ExternalLink, MessageCircle, Building2, Bookmark,
  UserCircle2, LayoutDashboard,
} from 'lucide-react';
import api, { assetUrl } from '../../../services/api';
import { setPainelToken } from '../../../services/apiPainel';
import { montarMensagemCadastroPublico, linkWhatsappComTexto, publicCarteirinhaUrl } from '../../../utils/carteirinhaWhatsapp';
import CapturaFoto from './CapturaFoto';
import Confete from './Confete';
import InputDataBR from './InputDataBR';

const NAVY = '#0B1F3A';
const GOLD = '#D4AF37';
const LIME = '#B8E62C';

const CATEGORIAS = ['Empregado', 'Empregador patronal', 'Profissional liberal'];
const GRAUS = [['conjuge', 'Cônjuge'], ['filho', 'Filho'], ['filha', 'Filha']];
const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

function maskCNPJ(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function maskCPF(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function validCPF(cpf) {
  const c = String(cpf || '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(c[10]);
}

const DEP_VAZIO = { nome: '', grau: '', data_nascimento: '' };
function novaChave() { return `novo${Date.now()}${Math.random()}`; }
const FORM_VAZIO = {
  nome_completo: '', cpf: '', data_nascimento: '', sexo: '', categoria_profissional: '',
  whatsapp: '', email: '', cidade: '', estado: '',
};

export default function CadastroPublico() {
  const navigate = useNavigate();
  const [step, setStep] = useState('cpf');

  // Landing — CPF primeiro, decide entre login (CPF já existe) e wizard novo
  const [cpfInicial, setCpfInicial] = useState('');
  const [verificandoCpf, setVerificandoCpf] = useState(false);
  const [nomeCurtoExistente, setNomeCurtoExistente] = useState('');

  // Login (CPF + data de nascimento) pra quem já tem cadastro
  const [dataLoginISO, setDataLoginISO] = useState(null);
  const [fazendoLogin, setFazendoLogin] = useState(false);
  const [erroLogin, setErroLogin] = useState(null);

  // Passo 1 — CNPJ
  const [cnpj, setCnpj] = useState('');
  const [statusCnpj, setStatusCnpj] = useState(null); // 'validando' | 'adimplente' | 'atrasada' | 'inativa' | 'nao_existe' | 'invalido'
  const [empresaInfo, setEmpresaInfo] = useState(null);
  const [mostrarFormSolicitar, setMostrarFormSolicitar] = useState(false);
  const [formSolicitar, setFormSolicitar] = useState({ nome_solicitante: '', whatsapp_solicitante: '', cargo: '', nome_empresa: '', mensagem: '' });
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false);
  const [solicitacaoEnviada, setSolicitacaoEnviada] = useState(false);

  // Passo 2 — dados pessoais
  const [form, setForm] = useState(FORM_VAZIO);
  const [errors, setErrors] = useState({});

  // Passo 3 — dependentes
  const [dependentes, setDependentes] = useState([]);

  // Passo 4 — foto
  const [foto, setFoto] = useState(null);

  // Passo 5 — revisão
  const [declaracaoAceita, setDeclaracaoAceita] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Tela final
  const [resultado, setResultado] = useState(null);

  function setCampo(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
    setErrors(e => ({ ...e, [campo]: '' }));
  }

  // ── Passo 1: validação de CNPJ (debounce) ─────────────────────────────
  useEffect(() => {
    const digits = cnpj.replace(/\D/g, '');
    setEmpresaInfo(null);
    setMostrarFormSolicitar(false);
    setSolicitacaoEnviada(false);
    if (digits.length !== 14) { setStatusCnpj(null); return; }

    setStatusCnpj('validando');
    const t = setTimeout(async () => {
      try {
        const res = await api.post('/public/cadastro/validar-cnpj', { cnpj: digits });
        setStatusCnpj(res.data.status);
        if (res.data.empresa) {
          setEmpresaInfo(res.data.empresa);
          setForm(f => ({ ...f, cidade: f.cidade || res.data.empresa.cidade || '', estado: f.estado || res.data.empresa.estado || '' }));
        }
      } catch {
        setStatusCnpj('invalido');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [cnpj]);

  async function handleEnviarSolicitacao(e) {
    e.preventDefault();
    if (!formSolicitar.nome_solicitante.trim() || !formSolicitar.whatsapp_solicitante) {
      toast.error('Preencha seu nome e WhatsApp');
      return;
    }
    setEnviandoSolicitacao(true);
    try {
      await api.post('/public/cadastro/solicitar-empresa', {
        cnpj: cnpj.replace(/\D/g, ''),
        nome_solicitante: formSolicitar.nome_solicitante.trim(),
        whatsapp: formSolicitar.whatsapp_solicitante.replace(/\D/g, ''),
        cargo: formSolicitar.cargo.trim() || undefined,
        nome_empresa: formSolicitar.nome_empresa.trim() || undefined,
        mensagem: formSolicitar.mensagem.trim() || undefined,
      });
      setSolicitacaoEnviada(true);
    } catch {
      toast.error('Erro ao enviar solicitação. Tente novamente.');
    } finally {
      setEnviandoSolicitacao(false);
    }
  }

  // ── Landing: CPF primeiro ──────────────────────────────────────────────
  async function handleContinuarCpf() {
    const digits = cpfInicial.replace(/\D/g, '');
    if (!validCPF(digits)) { toast.error('CPF inválido'); return; }

    setVerificandoCpf(true);
    try {
      const res = await api.post('/public/cadastro/verificar-cpf', { cpf: digits });
      if (res.data.existe) {
        setNomeCurtoExistente(res.data.nome_curto || '');
        setErroLogin(null);
        setStep('login_data');
      } else {
        setCampo('cpf', cpfInicial);
        setStep(1);
      }
    } catch {
      toast.error('Erro ao verificar CPF. Tente novamente.');
    } finally {
      setVerificandoCpf(false);
    }
  }

  // ── Login: CPF + data de nascimento pra quem já tem cadastro ──────────
  async function handleFazerLogin() {
    if (!dataLoginISO) return;
    setFazendoLogin(true);
    setErroLogin(null);
    try {
      const res = await api.post('/public/cadastro/login', {
        cpf: cpfInicial.replace(/\D/g, ''),
        data_nascimento: dataLoginISO,
      });
      setPainelToken(res.data.token);
      navigate('/meu-painel');
    } catch (err) {
      if (err.response?.status === 429) {
        setStep('login_bloqueado');
      } else {
        setErroLogin(err.response?.data?.error || 'Erro ao validar login');
      }
    } finally {
      setFazendoLogin(false);
    }
  }

  function validarPasso2() {
    const e = {};
    if (!form.nome_completo.trim()) e.nome_completo = 'Nome obrigatório';
    if (!form.data_nascimento) e.data_nascimento = 'Data de nascimento obrigatória';
    if (!form.sexo) e.sexo = 'Selecione uma opção';
    if (!form.categoria_profissional) e.categoria_profissional = 'Selecione uma categoria';
    if (form.whatsapp.replace(/\D/g, '').length < 10) e.whatsapp = 'WhatsApp obrigatório';
    if (!form.cidade.trim()) e.cidade = 'Cidade obrigatória';
    if (!form.estado) e.estado = 'Estado obrigatório';
    return e;
  }

  // ── Passo 3: dependentes ───────────────────────────────────────────────
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

  // ── Passo 5: envio final ────────────────────────────────────────────────
  async function handleFinalizar() {
    if (!foto) { toast.error('Tire sua foto antes de continuar'); return; }
    if (!declaracaoAceita) { toast.error('Aceite a declaração antes de continuar'); return; }
    if (!aceite) { toast.error('Aceite receber comunicações via WhatsApp'); return; }

    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('cnpj', cnpj.replace(/\D/g, ''));
      fd.append('nome_completo', form.nome_completo.trim());
      fd.append('cpf', form.cpf.replace(/\D/g, ''));
      fd.append('data_nascimento', form.data_nascimento);
      fd.append('sexo', form.sexo);
      fd.append('categoria_profissional', form.categoria_profissional);
      fd.append('whatsapp', form.whatsapp.replace(/\D/g, ''));
      if (form.email.trim()) fd.append('email', form.email.trim());
      fd.append('cidade', form.cidade.trim());
      fd.append('estado', form.estado);
      fd.append('dependentes', JSON.stringify(dependentes.filter(d => d.nome.trim())));
      fd.append('aceite_comunicacao', 'true');
      fd.append('declaracao_aceita', 'true');
      fd.append('foto', foto.blob, 'foto.jpg');

      const res = await api.post('/public/cadastro/finalizar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResultado({ ...res.data, tipo: 'cadastro' });
      setStep('final');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao enviar cadastro. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────

  if (solicitacaoEnviada) {
    return (
      <TelaMensagem
        icon={<CheckCircle2 className="w-14 h-14" style={{ color: LIME }} />}
        titulo="Recebemos!"
        texto="Renan vai entrar em contato com sua empresa. Fica de olho no seu WhatsApp!"
      />
    );
  }

  if (step === 'final' && resultado) {
    const urlTitular = publicCarteirinhaUrl(resultado.carteirinha_hash);
    // Link da mensagem (pra quando a pessoa reabrir isso dias/semanas depois)
    // aponta pro /cadastrar unificado, não pro token — quem tem sessão ativa
    // agora (acabou de provar identidade) vai direto pro painel pelo botão
    // "Ir para Meu Painel" abaixo, sem precisar digitar CPF+data de novo.
    const urlEntradaFutura = `${window.location.origin}/cadastrar`;
    const mensagem = montarMensagemCadastroPublico(urlTitular, urlEntradaFutura);
    const linkWpp = resultado.whatsapp ? linkWhatsappComTexto(resultado.whatsapp, mensagem) : null;

    function irParaPainel() {
      setPainelToken(resultado.token);
      navigate('/meu-painel');
    }

    return (
      <PageShell>
        <Confete />
        <div className="w-full max-w-[420px] bg-white rounded-[2rem] p-8 text-center space-y-5 shadow-2xl">
          <PartyPopper className="w-14 h-14 mx-auto" style={{ color: GOLD }} />
          <div>
            <h1 className="text-2xl font-black text-slate-900">Parabéns!</h1>
            <p className="text-slate-500 text-sm mt-1">Sua carteirinha digital está pronta!</p>
          </div>

          {resultado.foto_url && (
            <img src={assetUrl(resultado.foto_url)}
              alt="" className="w-24 h-24 rounded-full object-cover mx-auto border-4" style={{ borderColor: GOLD }} />
          )}

          <div className="space-y-2.5">
            {linkWpp ? (
              <a href={linkWpp} target="_blank" rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3.5 rounded-xl transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: '#25D366', color: 'white' }}>
                <MessageCircle className="w-4 h-4" /> Compartilhar via WhatsApp
              </a>
            ) : (
              <p className="text-amber-600 text-xs bg-amber-50 rounded-xl p-2.5">
                Não temos seu WhatsApp cadastrado — procure o Sindicato pra receber sua carteirinha.
              </p>
            )}
            <a href={urlTitular} target="_blank" rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 font-semibold text-sm py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
              <ExternalLink className="w-4 h-4" /> Ver minha carteirinha
            </a>
            <button onClick={irParaPainel}
              className="w-full flex items-center justify-center gap-2 font-semibold text-sm py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
              <LayoutDashboard className="w-4 h-4" /> Ir para Meu Painel
            </button>
          </div>

          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
            <Bookmark className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-amber-700 text-xs">
              <strong>Importante:</strong> guarde essa mensagem no seu WhatsApp! Ela tem seu link exclusivo pra editar o cadastro depois.
            </p>
          </div>

          <Link to="/" className="text-slate-400 text-xs underline">Voltar ao início</Link>
        </div>
      </PageShell>
    );
  }

  if (step === 'cpf') {
    return (
      <PageShell>
        <div className="w-full max-w-[420px]">
          <div className="text-center mb-6">
            <p className="text-white font-black text-2xl tracking-wide">SECI</p>
            <p className="text-white/60 text-sm mt-1">Faça sua carteirinha digital de associado</p>
          </div>
          <div className="bg-white rounded-[2rem] p-7 shadow-2xl space-y-4 text-center">
            <UserCircle2 className="w-12 h-12 mx-auto text-slate-300" />
            <h1 className="text-slate-900 font-bold text-lg">Digite seu CPF pra começar</h1>
            <input
              type="text" inputMode="numeric" placeholder="000.000.000-00"
              value={cpfInicial} onChange={e => setCpfInicial(maskCPF(e.target.value))}
              className="input text-center text-lg tracking-wide font-mono"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleContinuarCpf(); }}
            />
            <p className="text-slate-400 text-xs">Se você já tem carteirinha, vamos identificar automaticamente</p>
            <button
              onClick={handleContinuarCpf}
              disabled={verificandoCpf}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {verificandoCpf ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Continuar
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (step === 'login_data') {
    return (
      <PageShell>
        <div className="w-full max-w-[420px]">
          <div className="text-center mb-6">
            <p className="text-white font-black text-2xl tracking-wide">SECI</p>
          </div>
          <div className="bg-white rounded-[2rem] p-7 shadow-2xl space-y-4">
            <BotaoVoltar onClick={() => { setStep('cpf'); setErroLogin(null); }} />
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: LIME }} />
              <h1 className="text-slate-900 font-bold text-lg">Olá, {nomeCurtoExistente || 'associado'}!</h1>
              <p className="text-slate-500 text-sm mt-1">Encontramos seu cadastro. Pra continuar, confirme sua data de nascimento:</p>
            </div>
            <InputDataBR valueISO={dataLoginISO} onChangeISO={setDataLoginISO} autoFocus />
            {erroLogin && <p className="text-red-500 text-xs text-center">{erroLogin}</p>}
            <button
              onClick={handleFazerLogin}
              disabled={!dataLoginISO || fazendoLogin}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {fazendoLogin ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Confirmar
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (step === 'login_bloqueado') {
    return (
      <TelaMensagem
        icon={<AlertTriangle className="w-14 h-14 text-red-400" />}
        titulo="Não foi possível validar"
        texto="Você errou a data de nascimento algumas vezes. Por segurança, aguarde um tempo e tente de novo, ou fale com o Sindicato pra confirmar seu cadastro."
      />
    );
  }

  return (
    <PageShell>
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-6">
          <p className="text-white font-black text-2xl tracking-wide">SECI</p>
          <p className="text-white/60 text-sm mt-1">Faça sua carteirinha digital de associado</p>
        </div>

        <ProgressoTopo step={typeof step === 'number' ? step : 6} />

        <div className="bg-white rounded-[2rem] p-6 sm:p-7 mt-4 shadow-2xl">
          {step === 1 && (
            <div className="space-y-4">
              <BotaoVoltar onClick={() => setStep('cpf')} />
              <Titulo numero={1} texto="CNPJ da sua empresa" />
              <input
                type="text" inputMode="numeric" placeholder="00.000.000/0000-00"
                value={cnpj} onChange={e => setCnpj(maskCNPJ(e.target.value))}
                className="input text-center text-lg tracking-wide font-mono"
                autoFocus
              />

              {statusCnpj === 'validando' && (
                <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Verificando...
                </div>
              )}
              {statusCnpj === 'invalido' && (
                <CardAviso cor="red" icon={<XCircle className="w-5 h-5" />} texto="CNPJ inválido. Confira os números." />
              )}
              {statusCnpj === 'adimplente' && empresaInfo && (
                <CardAviso cor="green" icon={<CheckCircle2 className="w-5 h-5" />}
                  texto={`${empresaInfo.nome_fantasia || empresaInfo.razao_social} está em dia com o Sindicato!`} />
              )}
              {(statusCnpj === 'atrasada' || statusCnpj === 'inativa') && (
                <CardAviso cor="red" icon={<AlertTriangle className="w-5 h-5" />}
                  texto="Sua empresa está com pagamentos em atraso no Sindicato. Fale com o RH ou financeiro da sua empresa para regularizar. Assim que a empresa quitar, você poderá fazer seu cadastro!" />
              )}
              {statusCnpj === 'nao_existe' && !mostrarFormSolicitar && (
                <>
                  <CardAviso cor="amber" icon={<Building2 className="w-5 h-5" />}
                    texto="Sua empresa ainda não contribui com o Sindicato. Preencha abaixo pra avisarmos!" />
                  <button onClick={() => setMostrarFormSolicitar(true)} className="w-full btn-secondary">
                    Avisar o Sindicato
                  </button>
                </>
              )}

              {statusCnpj === 'nao_existe' && mostrarFormSolicitar && (
                <form onSubmit={handleEnviarSolicitacao} className="space-y-3 pt-2 border-t border-slate-100">
                  <Campo label="Seu nome *">
                    <input type="text" className="input" value={formSolicitar.nome_solicitante}
                      onChange={e => setFormSolicitar(f => ({ ...f, nome_solicitante: e.target.value }))} />
                  </Campo>
                  <Campo label="Seu WhatsApp *">
                    <input type="text" className="input" value={formSolicitar.whatsapp_solicitante}
                      onChange={e => setFormSolicitar(f => ({ ...f, whatsapp_solicitante: maskPhone(e.target.value) }))} />
                  </Campo>
                  <Campo label="Cargo">
                    <input type="text" className="input" value={formSolicitar.cargo}
                      onChange={e => setFormSolicitar(f => ({ ...f, cargo: e.target.value }))} />
                  </Campo>
                  <Campo label="Nome da empresa">
                    <input type="text" className="input" value={formSolicitar.nome_empresa}
                      onChange={e => setFormSolicitar(f => ({ ...f, nome_empresa: e.target.value }))} />
                  </Campo>
                  <Campo label="Mensagem (opcional)">
                    <textarea className="input" rows={2} value={formSolicitar.mensagem}
                      onChange={e => setFormSolicitar(f => ({ ...f, mensagem: e.target.value }))} />
                  </Campo>
                  <button type="submit" disabled={enviandoSolicitacao} className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                    {enviandoSolicitacao && <Loader2 className="w-4 h-4 animate-spin" />} Enviar solicitação
                  </button>
                </form>
              )}

              {statusCnpj === 'adimplente' && (
                <BotaoProximo onClick={() => setStep(2)} />
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <BotaoVoltar onClick={() => setStep(1)} />
              <Titulo numero={2} texto="Seus dados" />

              {empresaInfo && (
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 text-sm">
                  <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-slate-500">Empresa:</span>
                  <span className="text-slate-800 font-semibold truncate">{empresaInfo.nome_fantasia || empresaInfo.razao_social}</span>
                </div>
              )}

              <Campo label="Nome completo *" erro={errors.nome_completo}>
                <input type="text" className="input" value={form.nome_completo} onChange={e => setCampo('nome_completo', e.target.value)} />
              </Campo>

              <Campo label="Data de nascimento *" erro={errors.data_nascimento}>
                <InputDataBR valueISO={form.data_nascimento} onChangeISO={iso => setCampo('data_nascimento', iso || '')} idadeMinima={14} idadeMaxima={100} />
              </Campo>

              <Campo label="Sexo *" erro={errors.sexo}>
                <div className="flex gap-2">
                  {[['F', 'Feminino'], ['M', 'Masculino'], ['P', 'Prefiro não dizer']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setCampo('sexo', v)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${form.sexo === v ? 'text-white' : 'text-slate-500 border-slate-200'}`}
                      style={form.sexo === v ? { backgroundColor: NAVY, borderColor: NAVY } : undefined}>
                      {l}
                    </button>
                  ))}
                </div>
              </Campo>

              <Campo label="Categoria *" erro={errors.categoria_profissional}>
                <select className="input" value={form.categoria_profissional} onChange={e => setCampo('categoria_profissional', e.target.value)}>
                  <option value="">Selecione...</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Campo>

              <Campo label="WhatsApp *" erro={errors.whatsapp}>
                <input type="text" inputMode="numeric" className="input" value={form.whatsapp} onChange={e => setCampo('whatsapp', maskPhone(e.target.value))} />
              </Campo>

              <Campo label="E-mail (opcional)">
                <input type="email" className="input" value={form.email} onChange={e => setCampo('email', e.target.value)} />
              </Campo>

              <div className="grid grid-cols-2 gap-3">
                <Campo label="Cidade *" erro={errors.cidade}>
                  <input type="text" className="input" value={form.cidade} onChange={e => setCampo('cidade', e.target.value)} />
                </Campo>
                <Campo label="Estado *" erro={errors.estado}>
                  <select className="input" value={form.estado} onChange={e => setCampo('estado', e.target.value)}>
                    <option value="">UF</option>
                    {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </Campo>
              </div>

              <BotaoProximo onClick={() => {
                const e = validarPasso2();
                if (Object.keys(e).length) { setErrors(e); return; }
                setStep(3);
              }} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <BotaoVoltar onClick={() => setStep(2)} />
              <Titulo numero={3} texto="Dependentes (opcional)" />

              {dependentes.map((dep, idx) => (
                <div key={dep._key} className="border border-slate-200 rounded-xl p-3 space-y-2 relative">
                  <button onClick={() => removeDependente(idx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Campo label="Nome">
                    <input type="text" className="input" value={dep.nome} onChange={e => updateDependente(idx, 'nome', e.target.value)} />
                  </Campo>
                  <div className="grid grid-cols-2 gap-2">
                    <Campo label="Grau">
                      <select className="input" value={dep.grau} onChange={e => updateDependente(idx, 'grau', e.target.value)}>
                        <option value="">Selecione</option>
                        {GRAUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </Campo>
                    <Campo label="Nascimento">
                      <InputDataBR valueISO={dep.data_nascimento} onChangeISO={iso => updateDependente(idx, 'data_nascimento', iso || '')} />
                    </Campo>
                  </div>
                </div>
              ))}

              {dependentes.length < 6 && (
                <button onClick={addDependente} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm hover:border-movv-900/40 transition-colors">
                  <Plus className="w-4 h-4" /> Adicionar dependente
                </button>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(4)} className="flex-1 btn-secondary">Pular esta etapa</button>
                <BotaoProximo onClick={() => setStep(4)} className="flex-1" />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <BotaoVoltar onClick={() => setStep(3)} />
              <Titulo numero={4} texto="Foto ao vivo" />
              <CapturaFoto onCapturar={setFoto} fotoAtual={foto} />
              {foto && <BotaoProximo onClick={() => setStep(5)} texto="Usar essa foto e continuar" />}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <BotaoVoltar onClick={() => setStep(4)} />
              <Titulo numero={5} texto="Declaração" />

              <div className="border-2 rounded-2xl p-4 space-y-3" style={{ borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }}>
                <p className="flex items-center gap-2 font-bold text-amber-800 text-sm">
                  <AlertTriangle className="w-4 h-4" /> IMPORTANTE
                </p>
                <p className="text-amber-900 text-sm">Declaro, sob minha responsabilidade, que:</p>
                <ul className="space-y-1.5 text-amber-900 text-sm">
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" /> Sou colaborador ativo da empresa: <strong>{empresaInfo?.nome_fantasia || empresaInfo?.razao_social}</strong></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" /> Autorizei o desconto da Contribuição Assistencial na minha empresa</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" /> Todas as informações fornecidas são verdadeiras</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" /> Estou ciente que informações falsas podem resultar no cancelamento da minha carteirinha e responsabilização</li>
                </ul>

                <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-amber-200">
                  <input type="checkbox" checked={declaracaoAceita} onChange={e => setDeclaracaoAceita(e.target.checked)} className="mt-0.5 w-4 h-4" style={{ accentColor: '#B45309' }} />
                  <span className="text-amber-900 text-xs font-semibold">Li e concordo com a declaração acima</span>
                </label>

                <div>
                  <p className="text-amber-700 text-[10px] font-semibold uppercase tracking-wide">Nome completo (assinatura digital)</p>
                  <p className="text-amber-900 font-bold text-sm mt-0.5">{form.nome_completo || '—'}</p>
                </div>
              </div>

              <BotaoProximo onClick={() => setStep(6)} texto={declaracaoAceita ? 'Próximo' : 'Marque a declaração para continuar'} className={!declaracaoAceita ? 'opacity-50 pointer-events-none' : ''} />
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <BotaoVoltar onClick={() => setStep(5)} />
              <Titulo numero={6} texto="Revisão e envio" />

              <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                {foto && <img src={foto.previewUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2" style={{ borderColor: GOLD }} />}
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{form.nome_completo}</p>
                  <p className="text-slate-500 text-xs">{form.categoria_profissional} · {form.cidade}/{form.estado}</p>
                </div>
              </div>

              <div className="text-sm text-slate-600 space-y-1 bg-slate-50 rounded-xl p-3">
                <p><span className="text-slate-400">CPF:</span> {form.cpf}</p>
                <p><span className="text-slate-400">WhatsApp:</span> {form.whatsapp}</p>
                {form.email && <p><span className="text-slate-400">E-mail:</span> {form.email}</p>}
                <p><span className="text-slate-400">Empresa:</span> {empresaInfo?.nome_fantasia || empresaInfo?.razao_social}</p>
                {dependentes.filter(d => d.nome.trim()).length > 0 && (
                  <p><span className="text-slate-400">Dependentes:</span> {dependentes.filter(d => d.nome.trim()).map(d => d.nome).join(', ')}</p>
                )}
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} className="mt-0.5 w-4 h-4" style={{ accentColor: NAVY }} />
                <span className="text-slate-600 text-xs">Aceito receber comunicações do Sindicato via WhatsApp</span>
              </label>

              <button
                onClick={handleFinalizar}
                disabled={enviando || !aceite || !declaracaoAceita}
                className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-wide disabled:opacity-50 transition-transform hover:scale-[1.01] flex items-center justify-center gap-2"
                style={{ backgroundColor: LIME, color: NAVY }}
              >
                {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <PartyPopper className="w-5 h-5" />}
                Cadastrar e receber minha carteirinha
              </button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
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

function ProgressoTopo({ step }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5, 6].map(n => (
        <div key={n} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: n <= step ? LIME : 'rgba(255,255,255,0.15)' }} />
      ))}
    </div>
  );
}

function Titulo({ numero, texto }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ backgroundColor: NAVY, color: 'white' }}>{numero}</span>
      <h2 className="text-slate-900 font-bold text-lg">{texto}</h2>
    </div>
  );
}

function Campo({ label, erro, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
      {children}
      {erro && <p className="text-red-500 text-xs mt-1">{erro}</p>}
    </div>
  );
}

function CardAviso({ cor, icon, texto }) {
  const cls = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  }[cor];
  return (
    <div className={`flex items-start gap-2.5 border rounded-xl p-3 text-sm ${cls}`}>
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <span>{texto}</span>
    </div>
  );
}

function BotaoProximo({ onClick, texto = 'Próximo', className = '' }) {
  return (
    <button onClick={onClick} className={`btn-primary w-full flex items-center justify-center gap-2 ${className}`}>
      {texto} <ArrowRight className="w-4 h-4" />
    </button>
  );
}

function BotaoVoltar({ onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-xs font-medium transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" /> Voltar
    </button>
  );
}
