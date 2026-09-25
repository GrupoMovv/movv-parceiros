import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SignIn, User, Storefront } from '@phosphor-icons/react';
import api from '../../../services/api';
import { getPainelToken } from '../../../services/apiPainel';
import { soDigitos } from '../../../utils/documentos';
import { abrirSessao } from './abrirSessao';
import { CascaAcesso, Cartao, Campo, InputSenha, BotaoPrimario, BotaoWhatsapp, Aviso } from './AcessoUi';

// Só aceita voltar pra uma rota interna (nada de ?voltar=https://outro-site).
export function destinoSeguro(voltar) {
  return typeof voltar === 'string' && voltar.startsWith('/') && !voltar.startsWith('//') ? voltar : '/marketplace';
}

function identificadorValido(v) {
  if (v.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  const n = soDigitos(v).length;
  return n >= 10 && n <= 14;
}

// Login único do IUB MAIS+: pessoa (CPF ou WhatsApp -> /meu) e empresa
// parceira (CNPJ, e-mail ou WhatsApp pessoal -> /parceiro/painel). O
// servidor descobre quem é; se a mesma senha abre as duas contas, a pessoa
// escolhe. Associado antigo sem senha vai pro primeiro acesso.
export default function Entrar() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const voltar = destinoSeguro(params.get('voltar'));

  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState({});
  const [falha, setFalha] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [opcoes, setOpcoes] = useState(null); // senha abriu pessoa E empresa

  // Já logado como pessoa (favorito antigo, botão voltar): não mostra o formulário de novo.
  useEffect(() => {
    if (getPainelToken() && !voltar.startsWith('/parceiro/')) navigate(voltar, { replace: true });
  }, [navigate, voltar]);

  async function abrir(sessao) {
    if (!(await abrirSessao(sessao, navigate, voltar))) setFalha({ error: 'Não conseguimos abrir sua sessão agora. Tente de novo.' });
  }

  async function entrar(e) {
    e.preventDefault();
    setFalha(null);
    const novos = {};
    if (!identificadorValido(login)) novos.login = 'Digite seu CPF, CNPJ, e-mail ou WhatsApp com DDD.';
    if (!senha) novos.senha = 'Digite sua senha.';
    setErros(novos);
    if (Object.keys(novos).length) return;

    setEnviando(true);
    try {
      const identificador = login.includes('@') ? login.trim() : soDigitos(login);
      const res = await api.post('/public/conta/login', { login: identificador, senha });
      if (res.data.escolher) setOpcoes(res.data.opcoes);
      else await abrir(res.data);
    } catch (err) {
      const r = err.response?.data || {};
      if (r.code === 'PRIMEIRO_ACESSO') {
        navigate(`/entrar/primeiro-acesso?voltar=${encodeURIComponent(voltar)}`, { state: { cpf: r.via === 'cpf' ? soDigitos(login) : '' } });
      } else if (r.campo) {
        setErros({ [r.campo]: r.tentativas_restantes ? `${r.error} Restam ${r.tentativas_restantes} tentativa(s).` : r.error });
      } else {
        setFalha({ error: r.error || 'Não conseguimos entrar agora. Verifique sua internet e tente de novo.', code: r.code || (r.bloqueado ? 'BLOQUEADO' : null) });
      }
    } finally {
      setEnviando(false);
    }
  }

  if (opcoes) {
    return (
      <CascaAcesso titulo="Como você quer entrar?" subtitulo="Essa senha é da sua conta pessoal e da sua empresa." onVoltar={() => setOpcoes(null)} mensagemWhatsapp="Olá! Não estou conseguindo entrar no IUB MAIS+.">
        <Cartao className="space-y-3">
          {opcoes.map(o => (
            <button
              key={o.tipo} type="button" onClick={() => abrir(o)}
              className="w-full min-h-[64px] flex items-center gap-3 px-4 rounded-2xl border-2 text-left font-bold"
              style={{ borderColor: '#4C1D95', color: '#4C1D95' }}
            >
              {o.tipo === 'empresa' ? <Storefront size={26} weight="duotone" /> : <User size={26} weight="duotone" />}
              <span>
                {o.tipo === 'empresa' ? 'Entrar como empresa' : 'Entrar como pessoa'}
                <span className="block text-sm font-medium text-slate-500">{o.tipo === 'empresa' ? o.parceiro?.nome : `Olá, ${o.nome_curto}`}</span>
              </span>
            </button>
          ))}
          {falha && <Aviso tipo="erro" titulo={falha.error} />}
        </Cartao>
      </CascaAcesso>
    );
  }

  return (
    <CascaAcesso titulo="Entrar" voltarPara="/acesso" mensagemWhatsapp="Olá! Não estou conseguindo entrar no IUB MAIS+.">
      <Cartao>
        <form onSubmit={entrar} className="space-y-4" noValidate>
          <Campo label="CPF, CNPJ, e-mail ou WhatsApp" erro={erros.login} dica="Empresa parceira também entra por aqui.">
            <input
              className="input text-lg" type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus
              value={login} onChange={e => { setLogin(e.target.value); setErros(x => ({ ...x, login: null })); }}
              placeholder="CPF, CNPJ, e-mail ou WhatsApp"
            />
          </Campo>
          <Campo label="Senha" erro={erros.senha}>
            <InputSenha value={senha} autoComplete="current-password" onChange={e => { setSenha(e.target.value); setErros(x => ({ ...x, senha: null })); }} />
          </Campo>

          {falha && (
            <div className="space-y-3">
              <Aviso tipo={falha.code === 'NAO_ENCONTRADO' ? 'info' : 'erro'} titulo={falha.error} />
              {falha.code === 'NAO_ENCONTRADO' && (
                <Link to="/criar-conta" className="w-full min-h-[52px] flex items-center justify-center rounded-2xl font-black text-white" style={{ backgroundColor: '#4C1D95' }}>
                  CRIAR MINHA CONTA
                </Link>
              )}
              {['INATIVO', 'LOJA_INATIVA'].includes(falha.code) && <BotaoWhatsapp mensagem="Olá! Meu acesso ao IUB MAIS+ aparece como desativado." />}
            </div>
          )}

          <BotaoPrimario carregando={enviando}><SignIn size={20} weight="bold" /> ENTRAR</BotaoPrimario>

          <div className="text-center">
            <Link to="/entrar/esqueci-senha" className="inline-block text-sm font-semibold text-violet-800 underline underline-offset-4 min-h-[44px] leading-[44px]">
              Esqueci minha senha
            </Link>
          </div>
        </form>
      </Cartao>

      <p className="text-center text-white/80 text-sm mt-6">
        Não tem conta? <Link to="/criar-conta" className="font-bold text-white underline underline-offset-4">Criar conta grátis</Link>
      </p>
      <p className="text-center text-white/60 text-xs mt-2">
        Empresa sem cadastro? <Link to="/vender" className="font-semibold text-white/80 underline underline-offset-2">Cadastre grátis no IUB MAIS+</Link>
      </p>
    </CascaAcesso>
  );
}
