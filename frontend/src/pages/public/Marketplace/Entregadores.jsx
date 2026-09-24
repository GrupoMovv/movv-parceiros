import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, Loader2 } from 'lucide-react';
import api, { assetUrl } from '../../../services/api';
import TopNav from './components/TopNav';
import MobileBottomNav from './components/MobileBottomNav';
import Footer from './components/Footer';
import { useAssociadoSessao } from './useAssociadoSessao';
import { IMAGEM_ENTREGADOR_DESKTOP, IMAGEM_ENTREGADOR_MOBILE } from './components/heroSlides/SlideEntregador';
import { otimizarCloudinary } from '../../../utils/cloudinary';
import { ROXO, ROXO_ESCURO, DOURADO, PRETO } from './theme';
import { WhatsappLogo } from '@phosphor-icons/react';
import { CONTATO_IUB, linkWhatsappIub } from '../../../config/contato';

const MSG_WHATSAPP_ENTREGADOR = 'Olá! Vim pelo site IUB MAIS+ e quero saber mais sobre o IUB+ Entregadores. 🛵';

// IUB+ ENTREGADORES — página "em breve" com pré-cadastro de motoboys
// (lista de espera, salva em pre_cadastro_entregadores). Mobile-first: tudo
// empilha em 1 coluna e abre em grade do sm pra cima.

const CATEGORIAS = [
  { icone: '📦', nome: 'Produtos do marketplace' },
  { icone: '🍔', nome: 'Comida (IUB Food)' },
  { icone: '🍻', nome: 'Bebidas (IUB Disk Bebidas)' },
  { icone: '💊', nome: 'Farmácia', emBreve: true },
  { icone: '📄', nome: 'Documentos e encomendas' },
  { icone: '🎁', nome: 'Presentes' },
  { icone: '🛒', nome: 'Compras rápidas' },
];

const DIFERENCIAIS = [
  { icone: '💰', titulo: '100% DA TAXA É SUA', destaque: true },
  { icone: '🆓', titulo: 'Cadastro gratuito' },
  { icone: '🚫', titulo: 'Sem mensalidade' },
  { icone: '📱', titulo: 'Aceite só as entregas que quiser' },
  { icone: '🕐', titulo: 'Trabalhe quando quiser' },
];

const BENEFICIOS = [
  { icone: '⛽', texto: 'Descontos em combustível' },
  { icone: '🔧', texto: 'Descontos em oficinas parceiras' },
  { icone: '🛞', texto: 'Descontos em pneus' },
  { icone: '🛢️', texto: 'Desconto em troca de óleo' },
  { icone: '🪖', texto: 'Descontos em capacete/equipamentos' },
  { icone: '🏥', texto: 'Consulta médica gratuita' },
  { icone: '💊', texto: 'Descontos em farmácias' },
  { icone: '👥', texto: 'Comunidade de motoqueiros' },
];

// (64) 99999-8888 / (64) 3431-1234 — o backend só guarda os dígitos.
function mascararWhatsapp(valor) {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function TituloSecao({ children }) {
  return (
    <h2 className="text-xl sm:text-3xl font-black tracking-tight text-center" style={{ color: ROXO_ESCURO, fontFamily: 'Poppins, sans-serif' }}>
      {children}
    </h2>
  );
}

function FormularioPreCadastro({ onSucesso }) {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [temMoto, setTemMoto] = useState(null);
  const [bairros, setBairros] = useState([]);
  const [bairroNovo, setBairroNovo] = useState('');
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');

  function adicionarBairro(valor = bairroNovo) {
    const b = valor.trim().replace(/\s+/g, ' ');
    if (!b) return bairros;
    const novos = bairros.some(x => x.toLowerCase() === b.toLowerCase()) ? bairros : [...bairros, b];
    setBairros(novos);
    setBairroNovo('');
    setErros(e => ({ ...e, bairros: undefined }));
    return novos;
  }

  function validar(listaBairros) {
    const e = {};
    const nomeLimpo = nome.trim().replace(/\s+/g, ' ');
    if (nomeLimpo.length < 3 || !nomeLimpo.includes(' ')) e.nome = 'Informe seu nome completo (nome e sobrenome)';
    const digitos = whatsapp.replace(/\D/g, '');
    if (digitos.length < 10 || digitos.startsWith('0')) e.whatsapp = 'WhatsApp com DDD, ex.: (64) 99999-8888';
    if (temMoto === null) e.temMoto = 'Responda se você tem moto';
    if (!listaBairros.length) e.bairros = 'Adicione pelo menos um bairro';
    return e;
  }

  async function enviar(ev) {
    ev.preventDefault();
    // bairro digitado sem apertar Enter também conta
    const listaBairros = bairroNovo.trim() ? adicionarBairro() : bairros;
    const e = validar(listaBairros);
    setErros(e);
    setErroEnvio('');
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      await api.post('/public/entregadores/pre-cadastro', {
        nome: nome.trim(), whatsapp, tem_moto: temMoto, bairros: listaBairros,
      });
      onSucesso();
      setNome(''); setWhatsapp(''); setTemMoto(null); setBairros([]); setErros({});
    } catch (err) {
      setErroEnvio(err.response?.data?.error || 'Não deu pra enviar agora. Confira sua internet e tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  const classeInput = (temErro) => `w-full h-12 px-4 rounded-xl border-2 bg-white text-base text-slate-800 outline-none transition-colors ${
    temErro ? 'border-red-400' : 'border-slate-200 focus:border-[#4C1D95]'
  }`;

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <div>
        <label htmlFor="ent-nome" className="block text-sm font-bold text-slate-700 mb-1.5">Nome completo</label>
        <input
          id="ent-nome" type="text" autoComplete="name" value={nome}
          onChange={(e) => { setNome(e.target.value); setErros(x => ({ ...x, nome: undefined })); }}
          placeholder="Seu nome e sobrenome"
          className={classeInput(erros.nome)}
        />
        {erros.nome && <p className="text-xs text-red-500 mt-1">{erros.nome}</p>}
      </div>

      <div>
        <label htmlFor="ent-whatsapp" className="block text-sm font-bold text-slate-700 mb-1.5">WhatsApp</label>
        <input
          id="ent-whatsapp" type="tel" inputMode="numeric" autoComplete="tel-national" value={whatsapp}
          onChange={(e) => { setWhatsapp(mascararWhatsapp(e.target.value)); setErros(x => ({ ...x, whatsapp: undefined })); }}
          placeholder="(64) 99999-8888"
          className={classeInput(erros.whatsapp)}
        />
        {erros.whatsapp && <p className="text-xs text-red-500 mt-1">{erros.whatsapp}</p>}
      </div>

      <fieldset>
        <legend className="block text-sm font-bold text-slate-700 mb-1.5">Você tem moto?</legend>
        <div className="grid grid-cols-2 gap-3">
          {[[true, 'Sim'], [false, 'Não']].map(([valor, rotulo]) => (
            <label
              key={rotulo}
              className={`h-12 flex items-center justify-center gap-2 rounded-xl border-2 font-bold cursor-pointer transition-colors ${
                temMoto === valor ? 'text-white' : 'bg-white text-slate-600 border-slate-200'
              }`}
              style={temMoto === valor ? { backgroundColor: ROXO, borderColor: ROXO } : undefined}
            >
              <input
                type="radio" name="tem_moto" className="sr-only"
                checked={temMoto === valor}
                onChange={() => { setTemMoto(valor); setErros(x => ({ ...x, temMoto: undefined })); }}
              />
              {rotulo}
            </label>
          ))}
        </div>
        {erros.temMoto && <p className="text-xs text-red-500 mt-1">{erros.temMoto}</p>}
      </fieldset>

      <div>
        <label htmlFor="ent-bairro" className="block text-sm font-bold text-slate-700 mb-1.5">Bairros que atende</label>
        <div className="flex gap-2">
          <input
            id="ent-bairro" type="text" value={bairroNovo}
            onChange={(e) => setBairroNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); adicionarBairro(); } }}
            placeholder="Digite um bairro"
            className={`${classeInput(erros.bairros)} flex-1 min-w-0`}
          />
          <button
            type="button" onClick={() => adicionarBairro()} aria-label="Adicionar bairro"
            className="h-12 w-12 flex-shrink-0 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: ROXO }}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        {!bairros.some(b => b.toLowerCase() === 'toda a cidade') && (
          <button
            type="button" onClick={() => adicionarBairro('Toda a cidade')}
            className="mt-2 text-xs font-bold px-3 py-1.5 rounded-full border-2 border-dashed"
            style={{ borderColor: DOURADO, color: '#8A5E00' }}
          >
            + Toda a cidade
          </button>
        )}
        {bairros.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {bairros.map(b => (
              <span key={b} className="inline-flex items-center gap-1.5 text-sm font-semibold pl-3 pr-1.5 py-1.5 rounded-full text-white" style={{ backgroundColor: ROXO }}>
                {b}
                <button
                  type="button" onClick={() => setBairros(bairros.filter(x => x !== b))} aria-label={`Tirar ${b}`}
                  className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400 mt-1.5">Aperte Enter ou + depois de cada bairro.</p>
        {erros.bairros && <p className="text-xs text-red-500 mt-1">{erros.bairros}</p>}
      </div>

      {erroEnvio && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{erroEnvio}</p>}

      <button
        type="submit" disabled={enviando}
        className="w-full h-14 rounded-2xl font-black text-base tracking-wide flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform disabled:opacity-70"
        style={{ backgroundColor: DOURADO, color: PRETO, boxShadow: '0 8px 24px rgba(255,184,0,0.35)' }}
      >
        {enviando ? <><Loader2 className="w-5 h-5 animate-spin" /> ENVIANDO...</> : 'RESERVAR MEU LUGAR'}
      </button>
    </form>
  );
}

function ModalSucesso({ onFechar }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onFechar} role="dialog" aria-modal="true" aria-labelledby="ent-sucesso-titulo">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-8 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-5xl mb-3">🎉</div>
        <h3 id="ent-sucesso-titulo" className="text-2xl font-black" style={{ color: ROXO_ESCURO }}>Você está na lista!</h3>
        <p className="text-slate-600 mt-3 leading-relaxed">
          Assim que lançarmos oficialmente, você será um dos primeiros a saber. Prepare-se!
        </p>
        <button
          type="button" onClick={onFechar} autoFocus
          className="mt-6 w-full h-12 rounded-xl font-black text-white"
          style={{ backgroundColor: ROXO }}
        >
          Beleza!
        </button>
        <p className="text-xs text-slate-500 mt-4">
          Dúvidas?{' '}
          <a href={linkWhatsappIub(MSG_WHATSAPP_ENTREGADOR)} target="_blank" rel="noreferrer" className="font-bold underline" style={{ color: ROXO }}>
            Chame no WhatsApp {CONTATO_IUB.whatsappExibicao}
          </a>
        </p>
      </div>
    </div>
  );
}

export default function Entregadores() {
  const navigate = useNavigate();
  const { associado, carregando: carregandoAssociado, logout, recarregar } = useAssociadoSessao();
  const nomeAssociado = associado?.nome_completo?.trim().split(/\s+/)[0] || null;
  const [sucesso, setSucesso] = useState(false);

  function irParaFormulario() {
    document.getElementById('pre-cadastro')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen w-full bg-white flex flex-col pb-14 sm:pb-0">
      <TopNav
        nomeAssociado={nomeAssociado}
        nomeCompleto={associado?.nome_completo}
        fotoUrl={associado?.foto_url ? assetUrl(associado.foto_url) : null}
        carteirinhaHash={associado?.carteirinha_hash}
        carregandoAssociado={carregandoAssociado}
        onSair={logout}
        onLoginSuccess={recarregar}
        searchQuery=""
        onSearchChange={() => {}}
        onSearchSubmit={() => navigate('/marketplace')}
      />

      {/* Banner: mesmas peças do slide do carrossel (1:1 mobile, 3:1 desktop).
          Texto embaixo no mobile (a arte ocupa o topo), à esquerda no desktop
          — mesma faixa livre que o SlideBannerArteBase usa. */}
      <header className="relative w-full aspect-square sm:aspect-[3/1] overflow-hidden bg-iub-roxo-escuro">
        <picture>
          <source media="(max-width: 639px)" srcSet={otimizarCloudinary(IMAGEM_ENTREGADOR_MOBILE)} />
          <img
            src={otimizarCloudinary(IMAGEM_ENTREGADOR_DESKTOP)}
            alt="Motoboy do IUB MAIS+ pronto pra entregar em Itumbiara"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent sm:bg-gradient-to-r sm:from-black/60 sm:via-black/20 sm:to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 pb-7 text-center sm:inset-y-0 sm:right-auto sm:w-1/2 sm:p-0 sm:pl-[max(5.5%,32px)] sm:flex sm:flex-col sm:justify-center sm:text-left">
          <h1 className="text-white font-black leading-[1.05] tracking-tight text-[clamp(26px,8vw,40px)] sm:text-[clamp(28px,3.6vw,64px)]" style={{ fontFamily: 'Poppins, sans-serif', textShadow: '0 3px 14px rgba(0,0,0,0.5)' }}>
            🛵 IUB+ ENTREGADORES
          </h1>
          <p className="text-white/90 font-semibold mt-2 text-[clamp(15px,4.4vw,20px)] sm:text-[clamp(15px,1.8vw,30px)]" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
            Em breve. Reserve seu lugar.
          </p>
          <button
            type="button" onClick={irParaFormulario}
            className="mt-4 mx-auto sm:mx-0 w-fit px-6 h-12 rounded-2xl font-black"
            style={{ backgroundColor: DOURADO, color: PRETO, boxShadow: '0 8px 24px rgba(255,184,0,0.35)' }}
          >
            Reservar meu lugar
          </button>
        </div>
      </header>

      <main className="w-full">
        {/* 1 — Introdução */}
        <section className="px-5 py-10 sm:py-14 max-w-3xl mx-auto text-center">
          <p className="text-lg sm:text-2xl font-bold text-slate-700 leading-snug">
            Chegou uma nova oportunidade para motoboys de Itumbiara!
          </p>
          <p className="mt-4 text-2xl sm:text-4xl font-black leading-tight" style={{ color: ROXO }}>
            Você entrega TUDO.<br />
            <span style={{ color: '#B87E00' }}>Não só comida.</span>
          </p>
        </section>

        {/* 2 — O que você entrega */}
        <section className="px-5 pb-10 sm:pb-14 max-w-5xl mx-auto">
          <TituloSecao>O que você entrega</TituloSecao>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {CATEGORIAS.map(c => (
              <div key={c.nome} className="relative rounded-2xl bg-slate-50 border border-slate-100 px-3 py-5 text-center">
                <div className="text-3xl sm:text-4xl">{c.icone}</div>
                <p className="mt-2 text-sm font-bold text-slate-700 leading-tight">{c.nome}</p>
                {c.emBreve && (
                  <span className="absolute top-2 right-2 text-[9px] font-black px-1.5 py-[3px] rounded-full" style={{ backgroundColor: DOURADO, color: PRETO }}>
                    EM BREVE
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 3 — Diferenciais */}
        <section className="px-5 py-10 sm:py-14" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, ${ROXO} 100%)` }}>
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl sm:text-3xl font-black tracking-tight text-center text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Por que o IUB+
            </h2>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {DIFERENCIAIS.map(d => (
                <div
                  key={d.titulo}
                  className={`rounded-2xl px-4 py-5 flex lg:flex-col items-center gap-3 lg:text-center ${d.destaque ? 'sm:col-span-2 lg:col-span-1' : ''}`}
                  style={d.destaque ? { backgroundColor: DOURADO, color: PRETO } : { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                >
                  <span className="text-3xl flex-shrink-0">{d.icone}</span>
                  <p className={`font-black leading-tight ${d.destaque ? 'text-lg' : 'text-base'}`}>{d.titulo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4 — Benefícios */}
        <section className="px-5 py-10 sm:py-14 max-w-5xl mx-auto">
          <TituloSecao>Benefícios exclusivos</TituloSecao>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {BENEFICIOS.map(b => (
              <div key={b.texto} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white shadow-sm px-4 py-3.5">
                <span className="text-2xl flex-shrink-0">{b.icone}</span>
                <p className="text-sm font-semibold text-slate-700 leading-tight">{b.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 5 — Estratégia */}
        <section className="px-5 pb-10 sm:pb-14 max-w-3xl mx-auto">
          <div className="rounded-3xl px-6 py-8 text-center border-2" style={{ borderColor: DOURADO, backgroundColor: '#FFF8E6' }}>
            <p className="text-lg sm:text-2xl font-bold text-slate-800 leading-snug">
              O IUB é mais uma opção para você faturar em Itumbiara.
            </p>
            <p className="mt-2 text-xl sm:text-3xl font-black" style={{ color: ROXO }}>Trabalhe onde quiser.</p>
          </div>
        </section>

        {/* 6 — Formulário */}
        <section id="pre-cadastro" className="px-5 py-10 sm:py-14 bg-slate-50 scroll-mt-28">
          <div className="max-w-md mx-auto">
            <TituloSecao>🚀 GARANTA SEU LUGAR</TituloSecao>
            <p className="text-center text-slate-500 text-sm mt-2 mb-6">Leva menos de 1 minuto. Sem custo nenhum.</p>
            <div className="bg-white rounded-3xl shadow-lg p-5 sm:p-7">
              <FormularioPreCadastro onSucesso={() => setSucesso(true)} />
            </div>
          </div>
        </section>

        {/* 7 — CTA final */}
        <section className="px-5 py-10 sm:py-12 text-center" style={{ backgroundColor: PRETO }}>
          <p className="text-xl sm:text-3xl font-black tracking-tight" style={{ color: DOURADO, fontFamily: 'Poppins, sans-serif' }}>
            🚀 LANÇAMENTO OFICIAL: EM BREVE
          </p>
          <a
            href={linkWhatsappIub(MSG_WHATSAPP_ENTREGADOR)} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-white/80 hover:text-white"
          >
            <WhatsappLogo size={18} weight="fill" color="#25D366" /> Dúvidas? {CONTATO_IUB.whatsappExibicao}
          </a>
        </section>
      </main>

      <Footer />

      <MobileBottomNav nomeAssociado={nomeAssociado} onLoginSuccess={recarregar} />

      {sucesso && <ModalSucesso onFechar={() => setSucesso(false)} />}
    </div>
  );
}
