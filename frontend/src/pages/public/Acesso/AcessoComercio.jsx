import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, MagnifyingGlass } from '@phosphor-icons/react';
import api from '../../../services/api';
import { entrarNoPainelSeguro } from '../../../utils/entrarNoPainelSeguro';
import { soDigitos, validCNPJ, validCPF, maskCnpj, maskCpf, maskTelefone, telefoneValido } from '../../../utils/documentos';
import { CascaAcesso, Cartao, Campo, InputSenha, BotaoPrimario, BotaoWhatsapp, Aviso } from './AcessoUi';

const SENHA_MIN = 6;
const MSG_WHATSAPP = 'Olá! Quero associar minha empresa ao SECI pelo IUB MAIS+ e preciso de ajuda.';

// Fluxo 2 do /acesso — empresa do comércio que quer se associar ao SECI:
//   1) CNPJ -> se já está na Base SECI, manda pro Fluxo 1 (associado)
//   2) dados da empresa e do responsável + senha -> conta criada (usa o
//      marketplace enquanto o Sindicato analisa) -> tela de "recebemos"
export default function AcessoComercio() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [etapa, setEtapa] = useState(1);
  const [cnpj, setCnpj] = useState(() => maskCnpj(params.get('cnpj') || ''));
  const [consultando, setConsultando] = useState(false);
  const [erroCnpj, setErroCnpj] = useState(null);

  const [form, setForm] = useState({ nome_empresa: '', cpf: '', nome_completo: '', whatsapp: '', senha: '', confirmar: '' });
  const [aceite, setAceite] = useState(false);
  const [erros, setErros] = useState({});
  const [falha, setFalha] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(null); // { nome_curto }

  const cnpjDigits = soDigitos(cnpj);

  async function verificar(e) {
    e?.preventDefault();
    if (!validCNPJ(cnpjDigits)) { setErroCnpj('Esse CNPJ não é válido — confira os números.'); return; }
    setErroCnpj(null);
    setConsultando(true);
    try {
      const res = await api.get('/public/verificar-cnpj-seci', { params: { documento: cnpjDigits } });
      // Já está na base (em dia ou com pendência): o caminho é o do associado.
      if (res.data.encontrado) navigate(`/acesso/associado?documento=${cnpjDigits}`, { replace: true });
      else setEtapa(2);
    } catch (err) {
      setErroCnpj(err.response?.status === 429
        ? 'Muitas consultas seguidas. Espere alguns minutos e tente de novo.'
        : err.response?.data?.error || 'Não conseguimos consultar agora. Verifique sua internet e tente de novo.');
    } finally {
      setConsultando(false);
    }
  }

  // Vindo do Fluxo 1 ("não encontramos — quero me associar") o CNPJ já chega
  // preenchido e já conferido: pula direto pros dados.
  useEffect(() => {
    if (params.get('cnpj') && validCNPJ(cnpjDigits)) setEtapa(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(x => ({ ...x, [campo]: null }));
  }

  function validar() {
    const e = {};
    if (form.nome_empresa.trim().length < 2) e.nome_empresa = 'Digite o nome da empresa.';
    if (!validCPF(form.cpf)) e.cpf = 'CPF inválido — confira os números.';
    const nome = form.nome_completo.trim();
    if (nome.length < 3 || !nome.includes(' ')) e.nome_completo = 'Digite seu nome e sobrenome.';
    if (!telefoneValido(form.whatsapp)) e.whatsapp = 'Digite o WhatsApp com DDD. Ex.: (64) 99999-9999';
    if (form.senha.length < SENHA_MIN) e.senha = `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
    else if (form.senha !== form.confirmar) e.confirmar = 'As senhas não são iguais.';
    if (!aceite) e.aceite = 'Marque para o Sindicato poder falar com você.';
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(e) {
    e.preventDefault();
    setFalha(null);
    if (!validar()) return;
    setEnviando(true);
    try {
      const cpfDigits = soDigitos(form.cpf);
      const res = await api.post('/public/acesso/comercio', {
        cnpj: cnpjDigits,
        nome_empresa: form.nome_empresa,
        cpf: cpfDigits,
        nome_completo: form.nome_completo,
        whatsapp: soDigitos(form.whatsapp),
        senha: form.senha,
        aceite_comunicacao: aceite,
      });
      await entrarNoPainelSeguro(res.data.token, cpfDigits);
      setPronto({ nome_curto: res.data.nome_curto });
    } catch (err) {
      const d = err.response?.data || {};
      if (d.code === 'JA_NA_BASE') navigate(`/acesso/associado?documento=${cnpjDigits}`, { replace: true });
      else if (d.campo) setErros(x => ({ ...x, [d.campo]: d.error }));
      else setFalha({ error: d.error || 'Não conseguimos concluir agora. Verifique sua internet e tente de novo.', code: d.code });
    } finally {
      setEnviando(false);
    }
  }

  if (pronto) {
    return (
      <CascaAcesso titulo={`Recebemos, ${pronto.nome_curto}! 🎉`} voltarPara="/marketplace" mensagemWhatsapp={MSG_WHATSAPP} mascote>
        <Cartao className="space-y-4 text-center">
          <p className="text-slate-700">
            O pedido de associação da <strong>{form.nome_empresa.trim()}</strong> foi enviado ao SECI.
            O Sindicato vai falar com você pelo WhatsApp <strong>{form.whatsapp}</strong>.
          </p>
          <Aviso tipo="info" titulo="Sua conta já está pronta">
            Enquanto o Sindicato analisa, você já pode usar o IUB MAIS+. Quando a associação for aprovada, sua carteirinha aparece no seu painel.
          </Aviso>
          <BotaoPrimario type="button" onClick={() => navigate('/marketplace', { replace: true })}>
            IR PRO MARKETPLACE <ArrowRight size={18} weight="bold" />
          </BotaoPrimario>
        </Cartao>
      </CascaAcesso>
    );
  }

  if (etapa === 2) {
    return (
      <CascaAcesso
        titulo="Dados da empresa"
        subtitulo={`CNPJ ${cnpj} · Falta pouco!`}
        onVoltar={() => { setEtapa(1); setFalha(null); }}
        mensagemWhatsapp={MSG_WHATSAPP}
      >
        <Cartao>
          <form onSubmit={enviar} className="space-y-4" noValidate>
            <Campo label="Nome da empresa" erro={erros.nome_empresa} dica="Razão social ou nome fantasia">
              <input className="input" value={form.nome_empresa} onChange={e => set('nome_empresa', e.target.value)} placeholder="Ex.: Loja do João" />
            </Campo>

            <p className="font-black text-slate-900 pt-1">Responsável</p>

            <Campo label="Nome completo" erro={erros.nome_completo}>
              <input className="input" autoComplete="name" value={form.nome_completo} onChange={e => set('nome_completo', e.target.value)} />
            </Campo>

            <Campo label="CPF do responsável" erro={erros.cpf}>
              <input className="input" inputMode="numeric" value={form.cpf} onChange={e => set('cpf', maskCpf(e.target.value))} placeholder="000.000.000-00" />
            </Campo>

            <Campo label="WhatsApp" erro={erros.whatsapp} dica="O Sindicato fala com você por aqui — e é por ele que você recupera a senha.">
              <input className="input" inputMode="tel" autoComplete="tel" value={form.whatsapp} onChange={e => set('whatsapp', maskTelefone(e.target.value))} placeholder="(64) 99999-9999" />
            </Campo>

            <Campo label="Crie uma senha" erro={erros.senha} dica={`Mínimo de ${SENHA_MIN} caracteres.`}>
              <InputSenha value={form.senha} onChange={e => set('senha', e.target.value)} />
            </Campo>

            <Campo label="Confirme a senha" erro={erros.confirmar}>
              <InputSenha value={form.confirmar} onChange={e => set('confirmar', e.target.value)} />
            </Campo>

            <div>
              <label className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={aceite} onChange={e => { setAceite(e.target.checked); setErros(x => ({ ...x, aceite: null })); }} className="mt-0.5 w-5 h-5 accent-violet-700 flex-shrink-0" />
                Aceito que o SECI fale comigo pelo WhatsApp sobre a associação e os benefícios.
              </label>
              {erros.aceite && <p className="text-red-600 text-xs mt-1 ml-8">{erros.aceite}</p>}
            </div>

            {falha && (
              <div className="space-y-3">
                <Aviso tipo={falha.code ? 'info' : 'erro'} titulo={falha.error} />
                {falha.code === 'JA_TEM_CONTA' && (
                  <Link to="/entrar" className="w-full min-h-[52px] flex items-center justify-center rounded-2xl font-black text-white" style={{ backgroundColor: '#4C1D95' }}>FAZER LOGIN</Link>
                )}
                {falha.code === 'JA_E_ASSOCIADO' && (
                  <Link to="/acesso/associado" className="w-full min-h-[52px] flex items-center justify-center rounded-2xl font-black text-white" style={{ backgroundColor: '#4C1D95' }}>SOU ASSOCIADO SECI</Link>
                )}
              </div>
            )}

            <BotaoPrimario carregando={enviando}>ENVIAR PEDIDO DE ASSOCIAÇÃO</BotaoPrimario>
          </form>
        </Cartao>
      </CascaAcesso>
    );
  }

  return (
    <CascaAcesso
      titulo="Cadastro para associação"
      subtitulo="Associe sua empresa ao SECI — Sindicato do Comércio de Itumbiara. Leva 2 minutos."
      voltarPara="/acesso"
      mensagemWhatsapp={MSG_WHATSAPP}
    >
      <Cartao>
        <form onSubmit={verificar} className="space-y-4">
          <Campo label="CNPJ da empresa" erro={erroCnpj}>
            <input
              className="input text-lg tracking-wide" inputMode="numeric" autoFocus
              value={cnpj} onChange={e => { setCnpj(maskCnpj(e.target.value)); setErroCnpj(null); }}
              placeholder="00.000.000/0000-00"
            />
          </Campo>
          <BotaoPrimario carregando={consultando} disabled={cnpjDigits.length !== 14}>
            <MagnifyingGlass size={20} weight="bold" /> CONTINUAR
          </BotaoPrimario>
        </form>
        <div className="mt-4">
          <BotaoWhatsapp mensagem={MSG_WHATSAPP}>Prefiro falar com o Sindicato</BotaoWhatsapp>
        </div>
      </Cartao>
    </CascaAcesso>
  );
}
