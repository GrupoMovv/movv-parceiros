import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { SignIn } from '@phosphor-icons/react';
import api from '../../../services/api';
import { getPainelToken } from '../../../services/apiPainel';
import { entrarNoPainelSeguro } from '../../../utils/entrarNoPainelSeguro';
import { soDigitos } from '../../../utils/documentos';
import { CascaAcesso, Cartao, Campo, InputSenha, BotaoPrimario, BotaoWhatsapp, Aviso } from './AcessoUi';

// Só aceita voltar pra uma rota interna (nada de ?voltar=https://outro-site).
export function destinoSeguro(voltar) {
  return typeof voltar === 'string' && voltar.startsWith('/') && !voltar.startsWith('//') ? voltar : '/marketplace';
}

// Login do consumidor/associado: um campo "CPF ou WhatsApp" (o servidor
// descobre qual é) + senha. Associado antigo sem senha é mandado pro
// primeiro acesso.
export default function Entrar() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const voltar = destinoSeguro(params.get('voltar'));

  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState({});
  const [falha, setFalha] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Já logado (favorito antigo, botão voltar): não mostra o formulário de novo.
  useEffect(() => {
    if (getPainelToken()) navigate(voltar, { replace: true });
  }, [navigate, voltar]);

  async function entrar(e) {
    e.preventDefault();
    setFalha(null);
    const d = soDigitos(login);
    const novos = {};
    if (d.length !== 10 && d.length !== 11) novos.login = 'Digite seu CPF ou seu WhatsApp com DDD.';
    if (!senha) novos.senha = 'Digite sua senha.';
    setErros(novos);
    if (Object.keys(novos).length) return;

    setEnviando(true);
    try {
      const res = await api.post('/public/conta/login', { login: d, senha });
      const ok = await entrarNoPainelSeguro(res.data.token, { cpfParcial: res.data.cpf_parcial });
      if (!ok) {
        setFalha({ error: 'Não conseguimos abrir sua sessão agora. Tente de novo.' });
        return;
      }
      toast.success(`Olá, ${res.data.nome_curto}! 👋`);
      navigate(voltar, { replace: true });
    } catch (err) {
      const r = err.response?.data || {};
      if (r.code === 'PRIMEIRO_ACESSO') {
        navigate(`/entrar/primeiro-acesso?voltar=${encodeURIComponent(voltar)}`, { state: { cpf: r.via === 'cpf' ? d : '' } });
      } else if (r.campo) {
        setErros({ [r.campo]: r.tentativas_restantes ? `${r.error} Restam ${r.tentativas_restantes} tentativa(s).` : r.error });
      } else {
        setFalha({ error: r.error || 'Não conseguimos entrar agora. Verifique sua internet e tente de novo.', code: r.code || (r.bloqueado ? 'BLOQUEADO' : null) });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <CascaAcesso titulo="Entrar no IUB MAIS+" voltarPara="/acesso" mensagemWhatsapp="Olá! Não estou conseguindo entrar no IUB MAIS+.">
      <Cartao>
        <form onSubmit={entrar} className="space-y-4" noValidate>
          <Campo label="CPF ou WhatsApp" erro={erros.login}>
            <input
              className="input text-lg" inputMode="numeric" autoComplete="username" autoFocus
              value={login} onChange={e => { setLogin(e.target.value.replace(/[^\d.\-()/\s]/g, '')); setErros(x => ({ ...x, login: null })); }}
              placeholder="Seu CPF ou WhatsApp com DDD"
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
              {falha.code === 'INATIVO' && <BotaoWhatsapp mensagem="Olá! Meu cadastro no IUB MAIS+ aparece como desativado." />}
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
    </CascaAcesso>
  );
}
