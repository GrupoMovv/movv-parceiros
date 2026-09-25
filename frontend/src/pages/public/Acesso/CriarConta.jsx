import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, CircleNotch } from '@phosphor-icons/react';
import api from '../../../services/api';
import InputDataBR from '../Cadastro/InputDataBR';
import { entrarNoPainelSeguro } from '../../../utils/entrarNoPainelSeguro';
import { soDigitos, validCPF, validCNPJ, maskCpf, maskCnpj, maskTelefone, telefoneValido } from '../../../utils/documentos';
import { CascaAcesso, Cartao, Campo, InputSenha, BotaoPrimario, BotaoWhatsapp, Aviso } from './AcessoUi';

const SENHA_MIN = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VAZIO = {
  nome_completo: '', cpf: '', data_nascimento: null, whatsapp: '', email: '',
  cep: '', endereco: '', numero: '', bairro: '', cidade: '', estado: 'GO',
  cnpj: '', senha: '', confirmar: '',
};

function maskCep(v) {
  return soDigitos(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

// Cadastro único do IUB MAIS+ ("grátis pra todos"). A pessoa não escolhe
// "sou associado": se informar o CNPJ (opcional) de uma empresa em dia na
// Base SECI — ou se o próprio CPF for filiado em dia — já sai associada com
// carteirinha. O servidor decide o cenário; aqui só mostra o resultado.
export default function CriarConta() {
  const navigate = useNavigate();
  const [form, setForm] = useState(VAZIO);
  const [aceite, setAceite] = useState(false);
  const [erros, setErros] = useState({});
  const [falha, setFalha] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [empresa, setEmpresa] = useState(null); // prévia do CNPJ: { status, nome }
  const [resultado, setResultado] = useState(null);
  const ultimoCep = useRef('');

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(x => ({ ...x, [campo]: null }));
  }

  // CEP completo -> preenche rua, bairro, cidade e UF (ViaCEP, igual ao Meus Dados).
  useEffect(() => {
    const d = soDigitos(form.cep);
    if (d.length !== 8 || d === ultimoCep.current) return;
    ultimoCep.current = d;
    setBuscandoCep(true);
    fetch(`https://viacep.com.br/ws/${d}/json/`)
      .then(r => r.json())
      .then(data => {
        if (data.erro) { setErros(x => ({ ...x, cep: 'CEP não encontrado — confira ou preencha o endereço à mão.' })); return; }
        setForm(f => ({
          ...f,
          endereco: data.logradouro || f.endereco,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          estado: data.uf || f.estado,
        }));
      })
      .catch(() => {})
      .finally(() => setBuscandoCep(false));
  }, [form.cep]);

  // Prévia do CNPJ: a pessoa já vê, antes de enviar, o que vai acontecer.
  useEffect(() => {
    const d = soDigitos(form.cnpj);
    if (d.length !== 14) { setEmpresa(null); return; }
    if (!validCNPJ(d)) { setEmpresa({ status: 'invalido' }); return; }
    let cancelado = false;
    setEmpresa({ status: 'consultando' });
    api.get('/public/verificar-cnpj-seci', { params: { documento: d } })
      .then(res => {
        if (cancelado) return;
        const r = res.data;
        if (!r.encontrado) setEmpresa({ status: 'nao_encontrada' });
        else setEmpresa({ status: r.em_dia ? 'em_dia' : 'pendencia', nome: r.nome_fantasia || r.razao_social });
      })
      .catch(() => { if (!cancelado) setEmpresa(null); });
    return () => { cancelado = true; };
  }, [form.cnpj]);

  function validar() {
    const e = {};
    const nome = form.nome_completo.trim();
    if (nome.length < 3 || !nome.includes(' ')) e.nome_completo = 'Digite seu nome e sobrenome.';
    if (!validCPF(form.cpf)) e.cpf = 'CPF inválido — confira os números.';
    if (!form.data_nascimento) e.data_nascimento = 'Preencha sua data de nascimento.';
    if (!telefoneValido(form.whatsapp)) e.whatsapp = 'Digite o WhatsApp com DDD. Ex.: (64) 99999-9999';
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'E-mail inválido.';
    if (soDigitos(form.cep).length !== 8) e.cep = 'CEP inválido — são 8 números.';
    if (form.endereco.trim().length < 3) e.endereco = 'Digite a rua.';
    if (!form.numero.trim()) e.numero = 'Número (ou S/N).';
    if (form.bairro.trim().length < 2) e.bairro = 'Digite o bairro.';
    if (form.cidade.trim().length < 2) e.cidade = 'Digite a cidade.';
    if (soDigitos(form.cnpj) && !validCNPJ(form.cnpj)) e.cnpj = 'CNPJ inválido — confira ou deixe em branco.';
    if (form.senha.length < SENHA_MIN) e.senha = `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
    else if (form.senha !== form.confirmar) e.confirmar = 'As senhas não são iguais.';
    setErros(e);
    const primeiro = Object.keys(e)[0];
    if (primeiro) document.querySelector(`[data-campo="${primeiro}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return !primeiro;
  }

  async function criar(ev) {
    ev.preventDefault();
    setFalha(null);
    if (!validar()) return;
    setEnviando(true);
    try {
      const res = await api.post('/public/conta/criar', {
        nome_completo: form.nome_completo,
        cpf: soDigitos(form.cpf),
        data_nascimento: form.data_nascimento,
        whatsapp: soDigitos(form.whatsapp),
        email: form.email.trim(),
        cep: soDigitos(form.cep),
        endereco: form.endereco, numero: form.numero, bairro: form.bairro, cidade: form.cidade, estado: form.estado,
        cnpj: soDigitos(form.cnpj) || null,
        senha: form.senha,
        aceite_novidades: aceite,
      });
      const r = res.data;
      if (!(await entrarNoPainelSeguro(r.token, { cpfParcial: r.cpf_parcial }))) {
        setFalha({ error: 'Sua conta foi criada, mas não conseguimos abrir a sessão. Entre com seu CPF e a senha.', code: 'JA_TEM_CONTA' });
        return;
      }
      if (r.cenario === 'cliente' || r.cenario === 'associado_antigo') {
        toast.success(r.cenario === 'associado_antigo'
          ? `Você já era associado, ${r.nome_curto}! Senha criada. 🎉`
          : `Conta criada! Bem-vindo(a), ${r.nome_curto}! 🎉`);
        navigate('/marketplace', { replace: true });
        return;
      }
      setResultado(r);
    } catch (err) {
      const d = err.response?.data || {};
      if (d.campo) {
        setErros({ [d.campo]: d.tentativas_restantes ? `${d.error} Restam ${d.tentativas_restantes} tentativa(s).` : d.error });
        document.querySelector(`[data-campo="${d.campo}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setFalha({ error: d.error || 'Não conseguimos criar sua conta agora. Verifique sua internet e tente de novo.', code: d.code || (d.bloqueado ? 'BLOQUEADO' : null) });
      }
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) return <TelaResultado r={resultado} onContinuar={() => navigate('/marketplace', { replace: true })} />;

  const falarComSindicato = ['SEM_NASCIMENTO', 'INATIVO', 'BLOQUEADO'].includes(falha?.code);

  return (
    <CascaAcesso titulo="Criar minha conta" subtitulo="Grátis pra todos 💜" voltarPara="/acesso" mensagemWhatsapp="Olá! Estou criando minha conta no IUB MAIS+ e preciso de ajuda.">
      <Cartao>
        <form onSubmit={criar} className="space-y-4" noValidate>
          <div data-campo="nome_completo">
            <Campo label="Nome completo" erro={erros.nome_completo}>
              <input className="input" autoComplete="name" value={form.nome_completo} onChange={e => set('nome_completo', e.target.value)} />
            </Campo>
          </div>
          <div data-campo="cpf">
            <Campo label="CPF" erro={erros.cpf}>
              <input className="input" inputMode="numeric" value={form.cpf} onChange={e => set('cpf', maskCpf(e.target.value))} placeholder="000.000.000-00" />
            </Campo>
          </div>
          <div data-campo="data_nascimento">
            <Campo label="Data de nascimento" erro={erros.data_nascimento}>
              <InputDataBR className="input" valueISO={form.data_nascimento} onChangeISO={iso => set('data_nascimento', iso)} idadeMinima={14} />
            </Campo>
          </div>
          <div data-campo="whatsapp">
            <Campo label="WhatsApp" erro={erros.whatsapp} dica="Você entra com ele e recupera a senha por ele.">
              <input className="input" inputMode="tel" autoComplete="tel" value={form.whatsapp} onChange={e => set('whatsapp', maskTelefone(e.target.value))} placeholder="(64) 99999-9999" />
            </Campo>
          </div>
          <div data-campo="email">
            <Campo label="E-mail" erro={erros.email}>
              <input className="input" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="voce@email.com" />
            </Campo>
          </div>

          <div data-campo="cep">
            <Campo label="CEP" erro={erros.cep} dica={buscandoCep ? 'Buscando endereço...' : 'Preenche rua, bairro e cidade sozinho.'}>
              <div className="relative">
                <input className="input" inputMode="numeric" autoComplete="postal-code" value={form.cep} onChange={e => set('cep', maskCep(e.target.value))} placeholder="00000-000" />
                {buscandoCep && <CircleNotch size={18} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />}
              </div>
            </Campo>
          </div>
          <div className="grid grid-cols-[1fr_96px] gap-3">
            <div data-campo="endereco">
              <Campo label="Rua" erro={erros.endereco}>
                <input className="input" autoComplete="address-line1" value={form.endereco} onChange={e => set('endereco', e.target.value)} />
              </Campo>
            </div>
            <div data-campo="numero">
              <Campo label="Nº" erro={erros.numero}>
                <input className="input" value={form.numero} onChange={e => set('numero', e.target.value)} />
              </Campo>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div data-campo="bairro">
              <Campo label="Bairro" erro={erros.bairro}>
                <input className="input" value={form.bairro} onChange={e => set('bairro', e.target.value)} />
              </Campo>
            </div>
            <div data-campo="cidade">
              <Campo label="Cidade" erro={erros.cidade}>
                <input className="input" autoComplete="address-level2" value={form.cidade} onChange={e => set('cidade', e.target.value)} />
              </Campo>
            </div>
          </div>

          <div className="rounded-2xl p-4 space-y-3 bg-violet-50 border border-violet-200" data-campo="cnpj">
            <p className="font-black text-violet-900">💡 Você trabalha no comércio?</p>
            <p className="text-sm text-violet-900/80">Se sua empresa é associada ao SECI, você ganha descontos exclusivos automaticamente!</p>
            <Campo label="CNPJ da empresa (opcional)" erro={erros.cnpj}>
              <input className="input bg-white" inputMode="numeric" value={form.cnpj} onChange={e => set('cnpj', maskCnpj(e.target.value))} placeholder="00.000.000/0000-00" />
            </Campo>
            <PreviaEmpresa empresa={empresa} />
          </div>

          <div data-campo="senha">
            <Campo label="Crie uma senha" erro={erros.senha} dica={`Mínimo de ${SENHA_MIN} caracteres.`}>
              <InputSenha value={form.senha} onChange={e => set('senha', e.target.value)} />
            </Campo>
          </div>
          <div data-campo="confirmar">
            <Campo label="Confirme a senha" erro={erros.confirmar}>
              <InputSenha value={form.confirmar} onChange={e => set('confirmar', e.target.value)} />
            </Campo>
          </div>

          <label className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} className="mt-0.5 w-5 h-5 accent-violet-700 flex-shrink-0" />
            Quero receber ofertas e novidades do IUB MAIS+ pelo WhatsApp.
          </label>

          {falha && (
            <div className="space-y-3">
              <Aviso tipo={falarComSindicato ? 'alerta' : falha.code ? 'info' : 'erro'} titulo={falha.error} />
              {falarComSindicato && <BotaoWhatsapp mensagem="Olá! Sou associado SECI e não estou conseguindo criar minha conta no IUB MAIS+." />}
              {falha.code === 'JA_TEM_CONTA' && (
                <Link to="/entrar" className="w-full min-h-[52px] flex items-center justify-center rounded-2xl font-black text-white" style={{ backgroundColor: '#4C1D95' }}>ENTRAR</Link>
              )}
            </div>
          )}

          <BotaoPrimario carregando={enviando}>CRIAR CONTA</BotaoPrimario>
        </form>
      </Cartao>

      <p className="text-center text-white/80 text-sm mt-6">
        Já tem conta? <Link to="/entrar" className="font-bold text-white underline underline-offset-4">Entrar</Link>
      </p>
    </CascaAcesso>
  );
}

function PreviaEmpresa({ empresa }) {
  if (!empresa) return null;
  const textos = {
    consultando: ['text-slate-500', 'Consultando a base do SECI...'],
    invalido: ['text-red-600', 'Esse CNPJ não é válido — confira os números.'],
    em_dia: ['text-emerald-700', `✅ ${empresa.nome} é associada ao SECI — você vai ganhar preço de associado!`],
    pendencia: ['text-amber-700', `⚠️ ${empresa.nome} tem pendência com o SECI. Você entra como cliente e o Sindicato vai falar com você.`],
    nao_encontrada: ['text-violet-800', '💡 Não encontramos essa empresa na base do SECI. Você entra como cliente e o Sindicato vai verificar.'],
  };
  const [cls, texto] = textos[empresa.status];
  return <p className={`text-sm font-semibold ${cls}`}>{texto}</p>;
}

const RESULTADOS = {
  associado: {
    emoji: '🎊', titulo: 'Bem-vindo(a) associado(a) SECI!',
    texto: r => `${r.empresa_nome ? `Sua empresa, ${r.empresa_nome}, está em dia com o SECI. ` : ''}Seus descontos exclusivos já estão ativos e sua carteirinha digital (válida por 6 meses) está no seu painel.`,
    aviso: null,
  },
  pendencia: {
    emoji: '⚠️', titulo: 'Conta criada!',
    texto: r => `Detectamos pendência${r.empresa_nome ? ` com ${r.empresa_nome}` : ' com sua empresa'}. Vamos entrar em contato para regularizar sua associação.`,
    aviso: 'Enquanto isso você já usa o IUB MAIS+ com preço normal. Assim que a empresa regularizar, é só informar o CNPJ de novo no seu painel.',
  },
  nao_encontrada: {
    emoji: '💡', titulo: 'Conta criada!',
    texto: () => 'Sua empresa não foi encontrada na base SECI. Vamos entrar em contato para verificar sua associação!',
    aviso: 'Enquanto isso você já usa o IUB MAIS+ com preço normal.',
  },
};

function TelaResultado({ r, onContinuar }) {
  const c = RESULTADOS[r.cenario];
  return (
    <CascaAcesso titulo={`${c.emoji} ${c.titulo}`} mascote voltarPara="/marketplace">
      <Cartao className="space-y-4 text-center">
        <p className="text-slate-700">{c.texto(r)}</p>
        {c.aviso && <Aviso tipo="info" titulo={c.aviso} />}
        <BotaoPrimario type="button" onClick={onContinuar}>
          IR PRO MARKETPLACE <ArrowRight size={18} weight="bold" />
        </BotaoPrimario>
        {r.cenario === 'associado' && (
          <Link to="/meu/carteirinhas" className="block text-sm font-semibold text-violet-800 underline underline-offset-4 min-h-[44px] leading-[44px]">
            Ver minha carteirinha
          </Link>
        )}
      </Cartao>
    </CascaAcesso>
  );
}
