import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import InputDataBR from '../Cadastro/InputDataBR';
import { entrarNoPainelSeguro } from '../../../utils/entrarNoPainelSeguro';
import { soDigitos, validCPF, maskCpf, maskTelefone, telefoneValido } from '../../../utils/documentos';
import { destinoSeguro } from './Entrar';
import { CascaAcesso, Cartao, Campo, InputSenha, BotaoPrimario, BotaoWhatsapp, Aviso } from './AcessoUi';

const SENHA_MIN = 6;
const MSG_WHATSAPP = 'Olá! Sou associado SECI e preciso de ajuda pra fazer meu primeiro acesso no IUB MAIS+.';

// Primeiro acesso de quem já era associado antes das senhas (importado do
// Higestor, cadastro antigo): confirma a data de nascimento que o Sindicato
// tem e cria a senha. O /entrar manda pra cá quando o CPF existe sem senha.
export default function PrimeiroAcesso() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const voltar = destinoSeguro(params.get('voltar'));

  const [form, setForm] = useState({
    cpf: maskCpf(location.state?.cpf || ''), data_nascimento: null, whatsapp: '', senha: '', confirmar: '',
  });
  const [erros, setErros] = useState({});
  const [falha, setFalha] = useState(null);
  const [enviando, setEnviando] = useState(false);

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(x => ({ ...x, [campo]: null }));
  }

  function validar() {
    const e = {};
    if (!validCPF(form.cpf)) e.cpf = 'CPF inválido — confira os números.';
    if (!form.data_nascimento) e.data_nascimento = 'Preencha sua data de nascimento.';
    if (!telefoneValido(form.whatsapp)) e.whatsapp = 'Digite o WhatsApp com DDD. Ex.: (64) 99999-9999';
    if (form.senha.length < SENHA_MIN) e.senha = `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
    else if (form.senha !== form.confirmar) e.confirmar = 'As senhas não são iguais.';
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(ev) {
    ev.preventDefault();
    setFalha(null);
    if (!validar()) return;
    setEnviando(true);
    try {
      const cpf = soDigitos(form.cpf);
      const res = await api.post('/public/conta/primeiro-acesso', {
        cpf, data_nascimento: form.data_nascimento, whatsapp: soDigitos(form.whatsapp), senha: form.senha,
      });
      if (!(await entrarNoPainelSeguro(res.data.token, cpf))) {
        setFalha({ error: 'Sua senha foi criada, mas não conseguimos abrir a sessão. Entre com seu CPF e a senha nova.', code: 'JA_TEM_SENHA' });
        return;
      }
      toast.success(res.data.carteirinha_nova
        ? `Pronto, ${res.data.nome_curto}! Sua carteirinha digital já está no seu painel. 🎉`
        : `Pronto, ${res.data.nome_curto}! Senha criada. 🎉`);
      navigate(voltar, { replace: true });
    } catch (err) {
      const d = err.response?.data || {};
      if (d.campo) setErros({ [d.campo]: d.tentativas_restantes ? `${d.error} Restam ${d.tentativas_restantes} tentativa(s).` : d.error });
      else setFalha({ error: d.error || 'Não conseguimos concluir agora. Verifique sua internet e tente de novo.', code: d.code || (d.bloqueado ? 'BLOQUEADO' : null) });
    } finally {
      setEnviando(false);
    }
  }

  const falarComSindicato = ['SEM_NASCIMENTO', 'INATIVO', 'BLOQUEADO'].includes(falha?.code);

  return (
    <CascaAcesso
      titulo="Primeiro acesso 👋"
      subtitulo="Você já é associado! Confirme sua data de nascimento e crie sua senha."
      voltarPara="/entrar"
      mensagemWhatsapp={MSG_WHATSAPP}
    >
      <Cartao>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <Campo label="CPF" erro={erros.cpf}>
            <input className="input" inputMode="numeric" value={form.cpf} onChange={e => set('cpf', maskCpf(e.target.value))} placeholder="000.000.000-00" />
          </Campo>

          <Campo label="Data de nascimento" erro={erros.data_nascimento} dica="A mesma do seu cadastro no Sindicato.">
            <InputDataBR className="input" valueISO={form.data_nascimento} onChangeISO={iso => set('data_nascimento', iso)} autoFocus={Boolean(location.state?.cpf)} />
          </Campo>

          <Campo label="WhatsApp" erro={erros.whatsapp} dica="É por ele que você recupera a senha se esquecer.">
            <input className="input" inputMode="tel" autoComplete="tel" value={form.whatsapp} onChange={e => set('whatsapp', maskTelefone(e.target.value))} placeholder="(64) 99999-9999" />
          </Campo>

          <Campo label="Crie uma senha" erro={erros.senha} dica={`Mínimo de ${SENHA_MIN} caracteres.`}>
            <InputSenha value={form.senha} onChange={e => set('senha', e.target.value)} />
          </Campo>

          <Campo label="Confirme a senha" erro={erros.confirmar}>
            <InputSenha value={form.confirmar} onChange={e => set('confirmar', e.target.value)} />
          </Campo>

          {falha && (
            <div className="space-y-3">
              <Aviso tipo={falarComSindicato ? 'alerta' : falha.code ? 'info' : 'erro'} titulo={falha.error} />
              {falarComSindicato && <BotaoWhatsapp mensagem={MSG_WHATSAPP} />}
              {falha.code === 'JA_TEM_SENHA' && (
                <Link to="/entrar" className="w-full min-h-[52px] flex items-center justify-center rounded-2xl font-black text-white" style={{ backgroundColor: '#4C1D95' }}>ENTRAR</Link>
              )}
              {falha.code === 'NAO_ENCONTRADO' && (
                <Link to="/criar-conta" className="w-full min-h-[52px] flex items-center justify-center rounded-2xl font-black text-white" style={{ backgroundColor: '#4C1D95' }}>CRIAR MINHA CONTA</Link>
              )}
            </div>
          )}

          <BotaoPrimario carregando={enviando}>CRIAR SENHA E ENTRAR</BotaoPrimario>
        </form>
      </Cartao>
    </CascaAcesso>
  );
}
