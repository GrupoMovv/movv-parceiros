import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Loader2, PartyPopper, CheckCircle2, XCircle, ChevronDown, Search } from 'lucide-react';
import api from '../../../services/api';
import { ROXO, ROXO_ESCURO, DOURADO, PRETO } from './theme';

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const SEGMENTOS = [
  { valor: 'produtos', label: 'Produtos', emoji: '🛍️', desc: 'Roupas, eletrônicos, casa, beleza, saúde...' },
  { valor: 'servicos', label: 'Serviços', emoji: '🛠️', desc: 'Consultoria, reparos, estética, saúde...' },
  { valor: 'alimentacao', label: 'Alimentação', emoji: '🍔', desc: 'Restaurante, lanchonete, padaria, cafeteria...' },
  { valor: 'hospedagem', label: 'Hospedagem', emoji: '🏨', desc: 'Hotel, pousada, camping, temporada...' },
  { valor: 'automotivo', label: 'Automotivo', emoji: '🚗', desc: 'Veículos, peças, acessórios, oficinas, serviços automotivos...' },
  { valor: 'imoveis', label: 'Imóveis', emoji: '🏠', desc: 'Venda, aluguel, terrenos, casas, apartamentos, imóveis comerciais...' },
  { valor: 'turismo', label: 'Turismo, Lazer & Experiências', emoji: '🎯', desc: 'Passeios, atrações, eventos, lazer e experiências...' },
  { valor: 'outro', label: 'Outro', emoji: '🏷️', desc: 'Não encontrei meu segmento' },
];

const CATEGORIAS_POR_SEGMENTO = {
  produtos: ['Roupas e moda', 'Eletrônicos', 'Casa e decoração', 'Beleza e cosméticos', 'Saúde e farmácia', 'Presentes', 'Outros produtos'],
  servicos: ['Consultoria', 'Reparo e manutenção', 'Estética', 'Saúde', 'Educação', 'Outros serviços'],
  alimentacao: ['Restaurante', 'Lanchonete', 'Padaria', 'Cafeteria', 'Doces e salgados', 'Outros alimentos'],
  hospedagem: ['Hotel', 'Pousada', 'Camping', 'Temporada', 'Outros'],
  automotivo: ['Veículos', 'Peças e acessórios', 'Oficina mecânica', 'Funilaria e pintura', 'Outros serviços automotivos'],
  imoveis: ['Venda de imóveis', 'Aluguel', 'Terrenos', 'Imóveis comerciais', 'Outros'],
  turismo: ['Passeios e excursões', 'Atrações turísticas', 'Eventos', 'Lazer', 'Outras experiências'],
  outro: ['Outro'],
};

function vantagens(qtdAssociados) {
  return [
    { emoji: '🆓', titulo: '100% Gratuito', texto: 'Sem mensalidade, sem comissão. Anuncie até 30 produtos. Nossa missão: fortalecer o comércio de Itumbiara.' },
    { emoji: '💬', titulo: 'Cliente direto no seu WhatsApp', texto: 'Sem comissão, sem intermediário. Cliente fala com você.' },
    { emoji: '💎', titulo: 'Público qualificado', texto: `Alcance ${qtdAssociados ? `+${qtdAssociados} ` : ''}associados SECI ativos + toda Itumbiara.` },
    { emoji: '📊', titulo: 'Métricas em tempo real', texto: 'Veja quantos leads gerou, produtos mais vistos.' },
  ];
}

const PASSOS = [
  { n: 1, titulo: 'Cadastre sua loja', texto: '5 minutos, é só preencher o formulário.' },
  { n: 2, titulo: 'Aguarde aprovação', texto: 'Nossa equipe analisa em até 24h úteis.' },
  { n: 3, titulo: 'Publique produtos', texto: 'Anuncie e comece a receber clientes.' },
];

const FAQ = [
  { p: 'Preciso pagar alguma coisa?', r: 'Não! O IUB MAIS é 100% gratuito. Nossa missão é fortalecer o comércio de Itumbiara, então não cobramos mensalidade nem comissão dos parceiros.' },
  { p: 'Quanto tempo demora a aprovação?', r: 'Até 24h úteis depois do envio do cadastro.' },
  { p: 'Como recebo os clientes?', r: 'Direto no seu WhatsApp — sem intermediário.' },
  { p: 'Posso cancelar quando quiser?', r: 'Sim, quando quiser, sem burocracia.' },
];

function maskCNPJ(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function maskCPF(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function isValidCPF(cpf) {
  const c = String(cpf || '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i], 10) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i], 10) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(c[10], 10);
}

function isValidCNPJ(cnpj) {
  const c = String(cnpj || '').replace(/\D/g, '');
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calcDigito = (base) => {
    const pesos = base.length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const base12 = c.slice(0, 12);
  const d1 = calcDigito(base12);
  const d2 = calcDigito(base12 + String(d1));
  return c === base12 + String(d1) + String(d2);
}

const campoCls = 'w-full bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-[#4C1D95] transition-colors duration-200';

const FORM_VAZIO = {
  nome_fantasia: '', razao_social: '', cnpj: '', categoria_principal: '', descricao_curta: '',
  endereco: '', bairro: '', cidade: 'Itumbiara', estado: 'GO', whatsapp: '', instagram: '', email: '',
  responsavel_nome: '', responsavel_cpf: '', responsavel_cargo: '', termos_aceitos: false,
};

export default function Vender() {
  const navigate = useNavigate();
  const [tela, setTela] = useState('landing');
  const [segmento, setSegmento] = useState(null);
  const [etapa, setEtapa] = useState(1);
  const [form, setForm] = useState(FORM_VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [faqAberta, setFaqAberta] = useState(null);
  const [statusCnpj, setStatusCnpj] = useState(null); // null | 'checando' | 'ok' | { erro }
  const [consultaReceita, setConsultaReceita] = useState(null); // null | 'consultando' | { ok:true, situacaoInativa } | { ok:false, tipo }
  const [camposAutoPreenchidos, setCamposAutoPreenchidos] = useState(new Set()); // nomes dos campos que vieram da última consulta com sucesso — só pra exibir o selo "auto-preenchido"
  const cnpjReceitaConsultadoRef = useRef(''); // último CNPJ já auto-consultado na BrasilAPI, pra não repetir a cada render
  const [sindicalizacao, setSindicalizacao] = useState(null); // null | { e_sindicalizada }
  const [qtdAssociados, setQtdAssociados] = useState(null);
  const [vagasPioneiro, setVagasPioneiro] = useState(null);
  const [pioneiros, setPioneiros] = useState([]);

  useEffect(() => { window.scrollTo(0, 0); }, [tela]);

  useEffect(() => {
    api.get('/public/marketplace/stats').then(res => setQtdAssociados(res.data.associados)).catch(() => {});
    api.get('/public/marketplace/pioneiro-vagas').then(res => setVagasPioneiro(res.data)).catch(() => {});
    api.get('/public/marketplace/pioneiros').then(res => setPioneiros(res.data.parceiros || [])).catch(() => {});
  }, []);

  const cnpjDigits = form.cnpj.replace(/\D/g, '');
  useEffect(() => {
    if (cnpjDigits.length !== 14) { setStatusCnpj(null); return; }
    if (!isValidCNPJ(cnpjDigits)) { setStatusCnpj({ erro: 'CNPJ inválido' }); return; }
    setStatusCnpj('checando');
    const timer = setTimeout(() => {
      api.post('/public/vender/verificar-cnpj', { cnpj: cnpjDigits })
        .then(res => setStatusCnpj(res.data.disponivel ? 'ok' : { erro: res.data.motivo }))
        .catch(() => setStatusCnpj(null));
    }, 500);
    return () => clearTimeout(timer);
  }, [cnpjDigits]);

  // Auto-preenchimento via BrasilAPI (consulta pública, sem autenticação) —
  // reduz a fricção do cadastro buscando os dados cadastrais assim que o
  // CNPJ digitado é válido. Não bloqueia o cadastro se falhar (item 4 do
  // pedido): CNPJ não encontrado ou API fora do ar só avisam, e o parceiro
  // preenche manualmente. Usa `axios` puro (não a instância `api`) porque
  // `api` injeta o Bearer do Portal Movv em toda requisição via
  // interceptor — não deve vazar pra um domínio de terceiro.
  useEffect(() => {
    if (cnpjDigits.length !== 14 || !isValidCNPJ(cnpjDigits)) {
      setConsultaReceita(null);
      setCamposAutoPreenchidos(new Set());
      cnpjReceitaConsultadoRef.current = '';
      return;
    }
    if (cnpjReceitaConsultadoRef.current === cnpjDigits) return;
    const timer = setTimeout(() => {
      cnpjReceitaConsultadoRef.current = cnpjDigits;
      consultarCnpjReceita(cnpjDigits);
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cnpjDigits]);

  async function consultarCnpjReceita(digits, { forcarPreenchimento = false } = {}) {
    setConsultaReceita('consultando');
    try {
      const resp = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, { timeout: 8000 });
      const d = resp.data || {};
      const preenchidos = [];
      setForm(f => {
        const novo = { ...f };
        const preencher = (campo, valor) => {
          if (!valor) return;
          if (forcarPreenchimento || !String(novo[campo] || '').trim()) {
            novo[campo] = valor;
            preenchidos.push(campo);
          }
        };
        preencher('razao_social', d.razao_social);
        if (d.nome_fantasia) preencher('nome_fantasia', d.nome_fantasia);
        const enderecoBase = [d.logradouro, d.numero].filter(Boolean).join(', ');
        const enderecoCompleto = d.complemento ? [enderecoBase, d.complemento].filter(Boolean).join(' - ') : enderecoBase;
        preencher('endereco', enderecoCompleto);
        preencher('bairro', d.bairro);
        preencher('cidade', d.municipio);
        if (d.uf && ESTADOS.includes(d.uf)) preencher('estado', d.uf);
        preencher('email', d.email);
        return novo;
      });
      setCamposAutoPreenchidos(new Set(preenchidos));
      // `situacao_cadastral` na BrasilAPI é um código numérico (ex.: 2) — o
      // texto legível vem em `descricao_situacao_cadastral` ("ATIVA" etc.).
      const situacao = String(d.descricao_situacao_cadastral || '').trim();
      setConsultaReceita({ ok: true, situacaoInativa: situacao && situacao.toUpperCase() !== 'ATIVA' ? situacao : null });
    } catch (err) {
      setConsultaReceita({ ok: false, tipo: err.response?.status === 404 ? 'nao_encontrado' : 'indisponivel' });
    }
  }

  // Checagem de sindicalização (SECI) — só informativa aqui: avisa a
  // empresa que ela já ganha desconto nos planos pagos assim que forem
  // lançados (ou como conseguir o desconto), sem travar o cadastro.
  useEffect(() => {
    if (cnpjDigits.length !== 14 || !isValidCNPJ(cnpjDigits)) { setSindicalizacao(null); return; }
    const timer = setTimeout(() => {
      api.get('/public/planos/precos', { params: { cnpj: cnpjDigits } })
        .then(res => setSindicalizacao({ eSindicalizada: res.data.e_sindicalizada }))
        .catch(() => setSindicalizacao(null));
    }, 500);
    return () => clearTimeout(timer);
  }, [cnpjDigits]);

  function setCampo(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  function escolherSegmento(valor) {
    setSegmento(valor);
    setForm(f => ({ ...f, categoria_principal: '' }));
    setEtapa(1);
    setTela('formulario');
  }

  function validarEtapa1() {
    if (!isValidCNPJ(form.cnpj)) return 'CNPJ inválido';
    if (statusCnpj && statusCnpj.erro) return statusCnpj.erro;
    if (!consultaReceita || consultaReceita === 'consultando') return 'Aguarde a consulta do CNPJ terminar';
    if (!form.nome_fantasia.trim()) return 'Informe o nome fantasia';
    return null;
  }

  function validarEtapa2() {
    if (!form.endereco.trim()) return 'Informe o endereço';
    if (!form.bairro.trim()) return 'Informe o bairro';
    const d = form.whatsapp.replace(/\D/g, '');
    if (d.length < 10 || d.length > 11) return 'WhatsApp inválido';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'E-mail inválido';
    return null;
  }

  function validarEtapa3() {
    if (!form.responsavel_nome.trim()) return 'Informe o nome do responsável';
    if (!isValidCPF(form.responsavel_cpf)) return 'CPF do responsável inválido';
    if (!form.termos_aceitos) return 'É preciso aceitar os termos de uso';
    return null;
  }

  function avancar() {
    const erro = etapa === 1 ? validarEtapa1() : validarEtapa2();
    if (erro) { toast.error(erro); return; }
    setEtapa(e => e + 1);
  }

  async function enviarCadastro() {
    const erro = validarEtapa3();
    if (erro) { toast.error(erro); return; }
    setEnviando(true);
    try {
      await api.post('/public/vender/solicitacao', { ...form, segmento });
      setTela('confirmacao');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao enviar cadastro. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  if (tela === 'landing') return (
    <TelaLanding
      onComecar={() => setTela('segmento')} faqAberta={faqAberta} setFaqAberta={setFaqAberta}
      qtdAssociados={qtdAssociados} vagasPioneiro={vagasPioneiro} pioneiros={pioneiros}
    />
  );
  if (tela === 'segmento') return <TelaSegmento onVoltar={() => setTela('landing')} onEscolher={escolherSegmento} />;
  if (tela === 'confirmacao') return <TelaConfirmacao onVoltar={() => navigate('/marketplace')} />;

  return (
    <TelaFormulario
      segmento={segmento} etapa={etapa} form={form} setCampo={setCampo}
      statusCnpj={statusCnpj} consultaReceita={consultaReceita} camposAutoPreenchidos={camposAutoPreenchidos}
      sindicalizacao={sindicalizacao} enviando={enviando}
      onVoltarEtapa={() => (etapa === 1 ? setTela('segmento') : setEtapa(e => e - 1))}
      onAvancar={avancar} onEnviar={enviarCadastro}
      onConsultarReceitaNovamente={() => consultarCnpjReceita(cnpjDigits, { forcarPreenchimento: true })}
    />
  );
}

// ─── Tela 1: Landing ────────────────────────────────────────────────────────

function TelaLanding({ onComecar, faqAberta, setFaqAberta, qtdAssociados, vagasPioneiro, pioneiros }) {
  return (
    <div className="min-h-screen w-full bg-white">
      <section className="relative px-6 py-20 sm:py-28 text-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, ${ROXO} 55%, #7C3AED 100%)` }}>
        <div className="relative max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight tracking-tight">
            Anuncie seus produtos e serviços no IUB MAIS
          </h1>
          <p className="text-white/80 text-lg sm:text-xl mt-6 max-w-xl mx-auto">
            O marketplace de Itumbiara. Grátis, simples e direto no WhatsApp.
          </p>

          <span
            className="inline-flex items-center gap-2 mt-6 text-sm sm:text-base font-black uppercase tracking-wide px-5 py-2.5 rounded-full"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            🆓 100% Gratuito
          </span>
          <p className="text-white/60 text-xs sm:text-sm mt-2.5">Sem mensalidade. Sem comissão. Sem taxas.</p>

          <div>
            <button
              onClick={onComecar}
              className="inline-flex items-center gap-2 mt-10 text-base font-bold px-10 py-4 rounded-xl shadow-lg transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl"
              style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
            >
              Começar cadastro agora <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 sm:px-10 py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {vantagens(qtdAssociados).map(v => (
            <div key={v.titulo} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
              <span className="text-3xl">{v.emoji}</span>
              <p className="font-bold text-sm mt-3" style={{ color: PRETO }}>{v.titulo}</p>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{v.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Banner estratégico do IUB Food — mesmo fluxo de cadastro de
          qualquer parceiro (categoria "Alimentação" já basta pra aparecer
          em /marketplace/food, ver categorizacaoAutomatica em
          marketplaceHomeController.getFood), só um gancho visual a mais
          pra restaurante bater o olho e reconhecer que tem espaço dedicado
          pra ele. */}
      <section className="max-w-5xl mx-auto px-6 sm:px-10 -mt-2 mb-2">
        <button
          type="button"
          onClick={onComecar}
          className="w-full flex flex-col sm:flex-row items-center gap-4 sm:gap-6 rounded-3xl p-6 sm:p-8 text-left transition-transform hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 60%, #B87E00 150%)' }}
        >
          <span className="text-5xl flex-shrink-0">🍔</span>
          <div className="flex-1">
            <h2 className="text-white font-black text-lg sm:text-2xl">Você é restaurante? Cadastre na IUB Food!</h2>
            <p className="text-white/85 text-sm mt-1">Categoria dedicada com destaque — pizzaria, hamburgueria, marmita, açaí, doceria e mais.</p>
          </div>
          <span
            className="flex-shrink-0 inline-flex items-center gap-2 text-sm font-black px-5 py-2.5 rounded-xl whitespace-nowrap"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            Cadastrar agora <ArrowRight className="w-4 h-4" />
          </span>
        </button>
      </section>

      <section style={{ backgroundColor: `${ROXO}0D` }}>
        <div className="max-w-2xl mx-auto px-6 sm:px-10 py-16 text-center">
          <span className="text-4xl">🌆</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold mt-4" style={{ color: PRETO }}>Fortalecer o comércio local</h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed mt-5 whitespace-pre-line">
            {'O IUB MAIS nasceu com um propósito: fortalecer o comércio de Itumbiara. Enquanto grandes marketplaces levam vendas pra fora da cidade, criamos um espaço onde o comerciante local tem visibilidade, o consumidor encontra o que precisa perto de casa, e nossa cidade se fortalece.\n\nPor isso, não cobramos nada dos parceiros. Nossa recompensa é ver Itumbiara crescendo.'}
          </p>
          <p className="text-slate-400 text-xs font-semibold mt-6">— Junior, fundador</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 sm:px-10 py-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-12" style={{ color: PRETO }}>Como funciona</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {PASSOS.map(p => (
            <div key={p.n} className="text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black mx-auto text-white" style={{ backgroundColor: ROXO }}>
                {p.n}
              </div>
              <p className="font-bold text-sm mt-4" style={{ color: PRETO }}>{p.titulo}</p>
              <p className="text-slate-500 text-xs mt-1.5">{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-6 sm:px-10 py-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-8" style={{ color: PRETO }}>Perguntas frequentes</h2>
        <div className="space-y-2">
          {FAQ.map((f, i) => {
            const aberta = faqAberta === i;
            return (
              <div key={f.p} className="border border-slate-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setFaqAberta(aberta ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <span className="font-semibold text-sm" style={{ color: PRETO }}>{f.p}</span>
                  <ChevronDown className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform duration-300 ${aberta ? 'rotate-180' : ''}`} />
                </button>
                {aberta && <p className="px-5 pb-4 text-slate-500 text-sm">{f.r}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, ${ROXO} 100%)` }}>
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">🏆 SEJA UM PIONEIRO</h2>
          {vagasPioneiro && (
            <p className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold px-4 py-2 rounded-full" style={{ backgroundColor: `${DOURADO}22`, color: DOURADO }}>
              🔥 Só restam {vagasPioneiro.vagas_restantes} de {vagasPioneiro.total} vagas
            </p>
          )}
          <p className="text-white/80 text-sm mt-4 max-w-lg mx-auto leading-relaxed">
            Primeiros 20 parceiros ganham:
          </p>
          {/* Mesma lista do painel (Planos.jsx) — sem desconto na mensalidade:
              a cobrança é automática pelo Mercado Pago. */}
          <ul className="flex flex-col gap-2.5 mt-4 text-left max-w-xs mx-auto">
            {[
              'Selo dourado Pioneiro vitalício',
              'Destaque no marketplace',
              'Reconhecimento como parceiro fundador',
            ].map(b => (
              <li key={b} className="flex items-start gap-2 text-sm text-white/90">
                <span className="flex-shrink-0">✅</span> {b}
              </li>
            ))}
          </ul>
          <p className="text-white/80 text-sm font-semibold mt-6">Assine agora e faça parte da história do IUB MAIS+!</p>

          {pioneiros.length > 0 && (
            <div className="mt-10">
              <p className="text-white/50 text-xs font-bold uppercase tracking-wide mb-4">🏆 Mural da Fama</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {pioneiros.map(p => (
                  <div key={p.id} className="flex items-center gap-2 bg-white/10 rounded-full pl-1.5 pr-3.5 py-1.5">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-white/20 flex items-center justify-center flex-shrink-0 text-sm">
                      {p.logo_url ? <img src={p.logo_url} alt="" className="w-full h-full object-cover" /> : (p.icone || '⭐')}
                    </div>
                    <span className="text-white text-xs font-semibold">{p.nome}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-4" style={{ backgroundColor: ROXO_ESCURO }}>
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Pronto pra vender no IUB MAIS?</h2>
          <button
            onClick={onComecar}
            className="inline-block mt-8 text-base font-bold px-10 py-4 rounded-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            Cadastrar minha loja agora
          </button>
          <p className="text-white/50 text-sm mt-4">
            Já é parceiro cadastrado?{' '}
            <Link to="/parceiro/login" className="text-white/70 hover:text-white underline">Faça login</Link>
          </p>
        </div>
      </section>
    </div>
  );
}

// ─── Tela 2: Segmento ───────────────────────────────────────────────────────

function TelaSegmento({ onVoltar, onEscolher }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6 py-12" style={{ backgroundColor: '#FAFAFA' }}>
      <div className="w-full max-w-md">
        <button onClick={onVoltar} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-8">
          <h1 className="text-xl sm:text-2xl font-extrabold" style={{ color: PRETO }}>O que sua empresa oferece?</h1>
          <p className="text-slate-500 text-sm mt-1">Escolha o segmento principal da sua empresa.</p>

          <div className="space-y-3 mt-6">
            {SEGMENTOS.map(s => (
              <button
                key={s.valor}
                onClick={() => onEscolher(s.valor)}
                className="w-full flex items-center gap-4 text-left px-5 py-4 rounded-2xl border-2 border-slate-100 hover:border-[#4C1D95] transition-colors duration-200 group"
              >
                <span className="text-3xl flex-shrink-0">{s.emoji}</span>
                <div className="min-w-0">
                  <p className="font-bold text-sm uppercase tracking-wide" style={{ color: PRETO }}>{s.label}</p>
                  <p className="text-slate-500 text-xs mt-0.5 truncate">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Já tem cadastro?{' '}
          <Link to="/parceiro/login" className="font-semibold underline" style={{ color: ROXO }}>Fazer login como parceiro</Link>
        </p>
      </div>
    </div>
  );
}

// ─── Tela 3: Formulário (wizard) ────────────────────────────────────────────

function TelaFormulario({ segmento, etapa, form, setCampo, statusCnpj, consultaReceita, camposAutoPreenchidos, sindicalizacao, enviando, onVoltarEtapa, onAvancar, onEnviar, onConsultarReceitaNovamente }) {
  const seg = SEGMENTOS.find(s => s.valor === segmento);
  // Enquanto o CNPJ não passou pela consulta na BrasilAPI (ainda digitando,
  // inválido, ou consulta em andamento), os campos que ela preencheria
  // ficam ocultos — evita o cliente digitar Nome fantasia/Razão social à
  // mão só pra descobrir depois que o CNPJ preenchia tudo sozinho.
  const dadosEmpresaVisiveis = isValidCNPJ(form.cnpj) && !!consultaReceita && consultaReceita !== 'consultando';

  return (
    <div className="min-h-screen w-full px-6 py-10" style={{ backgroundColor: '#FAFAFA' }}>
      <div className="max-w-lg mx-auto">
        <button onClick={onVoltarEtapa} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {/* barra de progresso */}
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: n <= etapa ? ROXO : '#E5E7EB' }} />
          ))}
        </div>
        <p className="text-xs text-slate-400 mb-6">Etapa {etapa} de 3</p>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-8">
          {etapa === 1 && (
            <Etapa titulo="Dados da empresa">
              <div>
                <label className="block text-sm font-extrabold mb-1.5" style={{ color: PRETO }}>
                  CNPJ<span className="text-red-500"> *</span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    className={`${campoCls} pl-10 font-semibold`}
                    inputMode="numeric"
                    value={form.cnpj}
                    onChange={e => setCampo('cnpj', maskCNPJ(e.target.value))}
                    placeholder="Digite o CNPJ (nós preenchemos o resto)"
                    autoFocus
                  />
                </div>
                {!statusCnpj && !consultaReceita && (
                  <p className="text-[11px] text-slate-400 mt-1.5">🔍 Vamos buscar os dados da sua empresa automaticamente</p>
                )}
                <StatusCnpj status={statusCnpj} />
                <StatusConsultaReceita status={consultaReceita} onConsultarNovamente={onConsultarReceitaNovamente} />
                <AvisoSindicalizacao sindicalizacao={sindicalizacao} />
              </div>

              {dadosEmpresaVisiveis && (
                <>
                  <Campo label="Nome fantasia" obrigatorio badge={camposAutoPreenchidos.has('nome_fantasia')}>
                    <input className={campoCls} value={form.nome_fantasia} onChange={e => setCampo('nome_fantasia', e.target.value)} placeholder="Ex: Loja da Maria" />
                  </Campo>
                  <Campo label="Razão social" badge={camposAutoPreenchidos.has('razao_social')}>
                    <input className={campoCls} value={form.razao_social} onChange={e => setCampo('razao_social', e.target.value)} />
                  </Campo>
                </>
              )}

              <Campo label="Segmento">
                <div className={`${campoCls} flex items-center gap-2 bg-slate-50 text-slate-500`}>
                  <span>{seg?.emoji}</span> {seg?.label}
                </div>
              </Campo>
              <Campo label="Categoria principal">
                <select className={campoCls} value={form.categoria_principal} onChange={e => setCampo('categoria_principal', e.target.value)}>
                  <option value="">Selecione...</option>
                  {(CATEGORIAS_POR_SEGMENTO[segmento] || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Campo>
              <Campo label={`Descrição curta (${form.descricao_curta.length}/200)`}>
                <textarea className={`${campoCls} resize-none`} rows={3} maxLength={200} value={form.descricao_curta} onChange={e => setCampo('descricao_curta', e.target.value)} />
              </Campo>
            </Etapa>
          )}

          {etapa === 2 && (
            <Etapa titulo="Localização e contato">
              <Campo label="Endereço completo" obrigatorio badge={camposAutoPreenchidos.has('endereco')}>
                <input className={campoCls} value={form.endereco} onChange={e => setCampo('endereco', e.target.value)} placeholder="Rua, número" />
              </Campo>
              <Campo label="Bairro" obrigatorio badge={camposAutoPreenchidos.has('bairro')}>
                <input className={campoCls} value={form.bairro} onChange={e => setCampo('bairro', e.target.value)} />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Cidade" badge={camposAutoPreenchidos.has('cidade')}>
                  <input className={campoCls} value={form.cidade} onChange={e => setCampo('cidade', e.target.value)} />
                </Campo>
                <Campo label="Estado" badge={camposAutoPreenchidos.has('estado')}>
                  <select className={campoCls} value={form.estado} onChange={e => setCampo('estado', e.target.value)}>
                    {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </Campo>
              </div>
              <Campo label="WhatsApp" obrigatorio>
                <input className={campoCls} inputMode="numeric" value={form.whatsapp} onChange={e => setCampo('whatsapp', maskPhone(e.target.value))} placeholder="(64) 90000-0000" />
              </Campo>
              <Campo label="Instagram">
                <input className={campoCls} value={form.instagram} onChange={e => setCampo('instagram', e.target.value)} placeholder="@sualoja" />
              </Campo>
              <Campo label="E-mail" obrigatorio badge={camposAutoPreenchidos.has('email')}>
                <input className={campoCls} type="email" value={form.email} onChange={e => setCampo('email', e.target.value)} placeholder="voce@email.com" />
                <p className="text-[11px] text-slate-400 mt-1">É pra este e-mail que enviamos o login, se aprovado.</p>
              </Campo>
            </Etapa>
          )}

          {etapa === 3 && (
            <Etapa titulo="Dados do responsável">
              <Campo label="Nome completo do responsável" obrigatorio>
                <input className={campoCls} value={form.responsavel_nome} onChange={e => setCampo('responsavel_nome', e.target.value)} />
              </Campo>
              <Campo label="CPF" obrigatorio>
                <input className={campoCls} inputMode="numeric" value={form.responsavel_cpf} onChange={e => setCampo('responsavel_cpf', maskCPF(e.target.value))} placeholder="000.000.000-00" />
              </Campo>
              <Campo label="Cargo/função">
                <input className={campoCls} value={form.responsavel_cargo} onChange={e => setCampo('responsavel_cargo', e.target.value)} placeholder="Ex: Dono, Sócia, Gerente" />
              </Campo>

              <label className="flex items-start gap-3 mt-2 cursor-pointer">
                <input
                  type="checkbox" className="mt-0.5 w-4 h-4 flex-shrink-0"
                  checked={form.termos_aceitos} onChange={e => setCampo('termos_aceitos', e.target.checked)}
                />
                <span className="text-xs text-slate-500 leading-relaxed">
                  Declaro que sou o responsável legal por este comércio e concordo com os termos de uso do IUB MAIS.
                </span>
              </label>
            </Etapa>
          )}

          <div className="mt-8">
            {etapa < 3 ? (
              <button onClick={onAvancar} className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3.5 rounded-xl text-white transition-transform hover:-translate-y-0.5" style={{ backgroundColor: ROXO }}>
                Próximo <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onEnviar} disabled={enviando}
                className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3.5 rounded-xl text-[#0F0F14] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                style={{ backgroundColor: DOURADO }}
              >
                {enviando ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : 'Enviar cadastro'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Etapa({ titulo, children }) {
  return (
    <div className="space-y-4">
      <h2 className="font-bold text-lg" style={{ color: PRETO }}>{titulo}</h2>
      {children}
    </div>
  );
}

function Campo({ label, obrigatorio, badge, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
        <span>{label}{obrigatorio && <span className="text-red-500"> *</span>}</span>
        {badge && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold normal-case" style={{ color: '#166534' }}>
            <CheckCircle2 className="w-3 h-3" /> auto-preenchido
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function StatusCnpj({ status }) {
  if (!status) return null;
  if (status === 'checando') return <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Verificando...</p>;
  if (status === 'ok') return <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: '#166534' }}><CheckCircle2 className="w-3 h-3" /> CNPJ disponível</p>;
  const jaCadastrado = status.erro === 'Este CNPJ já está cadastrado como parceiro';
  return (
    <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
      <XCircle className="w-3 h-3" /> {status.erro}
      {jaCadastrado && <Link to="/parceiro/login" className="underline font-semibold">Fazer login?</Link>}
    </p>
  );
}

// Auto-preenchimento via BrasilAPI — só informativo, nunca trava o
// cadastro (CNPJ não encontrado ou API fora do ar apenas avisam).
function StatusConsultaReceita({ status, onConsultarNovamente }) {
  if (!status) return null;
  if (status === 'consultando') {
    return <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Consultando dados na Receita Federal...</p>;
  }
  if (status.ok) {
    return (
      <div className="mt-1.5 space-y-1.5">
        <p className="text-[11px] flex items-center gap-1.5" style={{ color: '#166534' }}>
          <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> Dados carregados! Confira e ajuste o que precisar.
          <button type="button" onClick={onConsultarNovamente} className="underline text-slate-400 hover:text-slate-600 flex-shrink-0">Consultar novamente</button>
        </p>
        {status.situacaoInativa && (
          <p className="text-[11px] rounded-lg px-2.5 py-1.5" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}>
            ⚠️ Situação cadastral na Receita Federal: <strong>{status.situacaoInativa}</strong>
          </p>
        )}
      </div>
    );
  }
  if (status.tipo === 'nao_encontrado') {
    return (
      <p className="text-[11px] mt-1 flex items-center gap-1.5" style={{ color: '#92700C' }}>
        ❌ CNPJ não encontrado na Receita Federal. Preencha manualmente.
        <button type="button" onClick={onConsultarNovamente} className="underline text-slate-400 hover:text-slate-600">Consultar novamente</button>
      </p>
    );
  }
  return (
    <p className="text-[11px] mt-1 flex items-center gap-1.5" style={{ color: '#92700C' }}>
      ⚠️ Consulta indisponível no momento. Preencha manualmente.
      <button type="button" onClick={onConsultarNovamente} className="underline text-slate-400 hover:text-slate-600">Consultar novamente</button>
    </p>
  );
}

// Só informativo — não trava o cadastro (que continua 100% grátis
// enquanto os planos pagos não são lançados). Avisa desde já quem já tem
// desconto garantido, ou como consegui-lo.
function AvisoSindicalizacao({ sindicalizacao }) {
  if (!sindicalizacao) return null;
  if (sindicalizacao.eSindicalizada) {
    return (
      <p className="text-[11px] mt-1.5 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: '#ECFDF5', color: '#166534' }}>
        🎉 Sua empresa é <strong>SINDICALIZADA ao SECI</strong> — você terá desconto exclusivo quando os planos pagos do IUB MAIS forem lançados!
      </p>
    );
  }
  return (
    <p className="text-[11px] mt-1.5 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: '#FFFBEB', color: '#92700C' }}>
      💡 Sua empresa ainda não está contribuindo com o SECI — sindicalize-se e ganhe desconto nos planos pagos do IUB MAIS. Saiba como pelo WhatsApp.
    </p>
  );
}

// ─── Tela 4: Confirmação ────────────────────────────────────────────────────

function TelaConfirmacao({ onVoltar }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6 text-center" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, ${ROXO} 100%)` }}>
      <div className="max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-xl mb-6 mx-auto">
          <PartyPopper className="w-8 h-8" style={{ color: DOURADO }} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Cadastro enviado com sucesso!</h1>
        <p className="text-white/80 text-sm sm:text-base mt-3">
          Seu cadastro está em análise. Você receberá um e-mail ou WhatsApp em até 24h com o resultado e, se aprovado, suas credenciais de acesso.
        </p>
        <p className="font-semibold text-sm sm:text-base mt-5" style={{ color: DOURADO }}>
          Bem-vindo(a) ao movimento IUB MAIS. Juntos vamos fortalecer o comércio da nossa cidade!
        </p>
        <button
          onClick={onVoltar}
          className="inline-block mt-8 text-sm font-bold px-8 py-4 rounded-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl"
          style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
        >
          Voltar pra home
        </button>
      </div>
    </div>
  );
}
