import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { WhatsappLogo } from '@phosphor-icons/react';
import api from '../../../services/api';
import { entrarNoPainelSeguro } from '../../../utils/entrarNoPainelSeguro';
import { soDigitos, maskCpf, maskTelefone, telefoneValido } from '../../../utils/documentos';
import { CascaAcesso, Cartao, Campo, InputSenha, BotaoPrimario, BotaoWhatsapp, Aviso } from './AcessoUi';

const SENHA_MIN = 6;
const MSG_SUPORTE = 'Olá! Esqueci minha senha do IUB MAIS+ e não estou conseguindo receber o código.';

// "Esqueci minha senha": WhatsApp -> código de 6 dígitos nesse WhatsApp ->
// senha nova -> já entra logado. Pede só o WhatsApp (e não CPF) porque é
// lá que o código chega.
export default function EsqueciSenha() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState(1);
  const [whatsapp, setWhatsapp] = useState('');
  const [cpf, setCpf] = useState('');
  const [pedirCpf, setPedirCpf] = useState(false);
  const [envio, setEnvio] = useState(null); // { pedido, whatsapp_mascarado, validade_min, reenvio_seg }
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erros, setErros] = useState({});
  const [falha, setFalha] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [aguarde, setAguarde] = useState(0);

  useEffect(() => {
    if (aguarde <= 0) return undefined;
    const t = setTimeout(() => setAguarde(a => a - 1), 1000);
    return () => clearTimeout(t);
  }, [aguarde]);

  async function pedirCodigo(e) {
    e?.preventDefault();
    setFalha(null); setErros({});
    const d = soDigitos(whatsapp);
    if (!telefoneValido(d)) { setErros({ whatsapp: 'Digite seu WhatsApp com DDD. Ex.: (64) 99999-9999' }); return; }
    setEnviando(true);
    try {
      const res = await api.post('/public/conta/esqueci-senha', { whatsapp: d, cpf: pedirCpf ? soDigitos(cpf) : undefined });
      setEnvio(res.data);
      setAguarde(res.data.reenvio_seg);
      setCodigo('');
      setEtapa(2);
      toast.success('Código enviado pelo WhatsApp!');
    } catch (err) {
      const r = err.response?.data || {};
      if (r.code === 'PRIMEIRO_ACESSO') navigate('/entrar/primeiro-acesso');
      else if (r.code === 'INFORME_CPF') { setPedirCpf(true); setFalha({ error: r.error, code: r.code }); }
      else if (r.code === 'AGUARDE') { setAguarde(r.aguarde_seg); setFalha({ error: r.error, code: r.code }); }
      else if (r.campo) setErros({ [r.campo]: r.error });
      else setFalha({ error: r.error || 'Não conseguimos enviar o código agora. Tente de novo.', code: r.code });
    } finally {
      setEnviando(false);
    }
  }

  async function trocarSenha(e) {
    e.preventDefault();
    setFalha(null);
    const novos = {};
    if (soDigitos(codigo).length !== 6) novos.codigo = 'O código tem 6 números.';
    if (senha.length < SENHA_MIN) novos.senha = `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
    else if (senha !== confirmar) novos.confirmar = 'As senhas não são iguais.';
    setErros(novos);
    if (Object.keys(novos).length) return;
    setEnviando(true);
    try {
      const res = await api.post('/public/conta/redefinir-senha', { pedido: envio.pedido, codigo: soDigitos(codigo), senha });
      if (!(await entrarNoPainelSeguro(res.data.token, { cpfParcial: res.data.cpf_parcial }))) {
        toast.success('Senha trocada! Entre com a senha nova.');
        navigate('/entrar', { replace: true });
        return;
      }
      toast.success(`Senha trocada, ${res.data.nome_curto}! 🎉`);
      navigate('/marketplace', { replace: true });
    } catch (err) {
      const r = err.response?.data || {};
      if (r.campo) setErros({ [r.campo]: r.error });
      else setFalha({ error: r.error || 'Não conseguimos trocar a senha agora. Tente de novo.', code: r.code });
    } finally {
      setEnviando(false);
    }
  }

  const precisaSuporte = ['ENVIO_FALHOU', 'LIMITE_CODIGOS', 'SEM_WHATSAPP', 'INATIVO'].includes(falha?.code);

  return (
    <CascaAcesso
      titulo="Esqueci minha senha"
      subtitulo={etapa === 1 ? 'A gente manda um código pro seu WhatsApp.' : 'Falta pouco!'}
      onVoltar={etapa === 2 ? () => { setEtapa(1); setFalha(null); } : undefined}
      voltarPara="/entrar"
      mensagemWhatsapp={MSG_SUPORTE}
    >
      <Cartao>
        {etapa === 1 ? (
          <form onSubmit={pedirCodigo} className="space-y-4" noValidate>
            <Campo label="WhatsApp" erro={erros.whatsapp} dica="O mesmo número que está na sua conta.">
              <input className="input text-lg" inputMode="tel" autoComplete="tel" autoFocus value={whatsapp}
                onChange={e => { setWhatsapp(maskTelefone(e.target.value)); setErros({}); }}
                placeholder="(64) 99999-9999" />
            </Campo>
            {pedirCpf && (
              <Campo label="Seu CPF" erro={erros.cpf}>
                <input className="input" inputMode="numeric" value={cpf} onChange={e => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" />
              </Campo>
            )}
            {falha && (
              <div className="space-y-3">
                <Aviso tipo={falha.code === 'INFORME_CPF' || falha.code === 'AGUARDE' ? 'info' : 'erro'} titulo={falha.error} />
                {falha.code === 'NAO_ENCONTRADO' && (
                  <>
                    <Link to="/entrar/primeiro-acesso" className="w-full min-h-[52px] flex items-center justify-center rounded-2xl font-black text-white" style={{ backgroundColor: '#4C1D95' }}>SOU ASSOCIADO — PRIMEIRO ACESSO</Link>
                    <Link to="/criar-conta" className="w-full min-h-[48px] flex items-center justify-center rounded-2xl font-bold border-2" style={{ borderColor: '#4C1D95', color: '#4C1D95' }}>CRIAR MINHA CONTA</Link>
                  </>
                )}
                {precisaSuporte && <BotaoWhatsapp mensagem={MSG_SUPORTE} />}
              </div>
            )}
            <BotaoPrimario carregando={enviando} disabled={aguarde > 0}>
              <WhatsappLogo size={20} weight="fill" /> {aguarde > 0 ? `AGUARDE ${aguarde}s` : 'ENVIAR CÓDIGO'}
            </BotaoPrimario>
          </form>
        ) : (
          <form onSubmit={trocarSenha} className="space-y-4" noValidate>
            <Aviso tipo="ok" titulo={`Enviamos um código para ${envio.whatsapp_mascarado}`}>
              Vale por {envio.validade_min} minutos. Não chegou? Confira se o WhatsApp é esse mesmo.
            </Aviso>
            <Campo label="Código de 6 números" erro={erros.codigo}>
              <input className="input text-2xl tracking-[0.5em] text-center" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6}
                value={codigo} onChange={e => { setCodigo(soDigitos(e.target.value).slice(0, 6)); setErros(x => ({ ...x, codigo: null })); }} />
            </Campo>
            <Campo label="Nova senha" erro={erros.senha} dica={`Mínimo de ${SENHA_MIN} caracteres.`}>
              <InputSenha value={senha} onChange={e => { setSenha(e.target.value); setErros(x => ({ ...x, senha: null })); }} />
            </Campo>
            <Campo label="Confirme a nova senha" erro={erros.confirmar}>
              <InputSenha value={confirmar} onChange={e => { setConfirmar(e.target.value); setErros(x => ({ ...x, confirmar: null })); }} />
            </Campo>
            {falha && (
              <div className="space-y-3">
                <Aviso tipo="erro" titulo={falha.error} />
                {precisaSuporte && <BotaoWhatsapp mensagem={MSG_SUPORTE} />}
              </div>
            )}
            <BotaoPrimario carregando={enviando}>TROCAR SENHA E ENTRAR</BotaoPrimario>
            <button type="button" onClick={() => pedirCodigo()} disabled={aguarde > 0 || enviando}
              className="w-full text-sm font-semibold text-violet-800 underline underline-offset-4 min-h-[44px] disabled:opacity-50 disabled:no-underline">
              {aguarde > 0 ? `Reenviar código em ${aguarde}s` : 'Reenviar código'}
            </button>
          </form>
        )}
      </Cartao>
    </CascaAcesso>
  );
}
