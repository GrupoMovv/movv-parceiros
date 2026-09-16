import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowRight, ArrowLeft, Storefront, ShoppingBag } from '@phosphor-icons/react';
import MascoteIubMais from '../../components/MascoteIubMais';

// Números validados (SBVC 2025 + IBGE 2024) — GMV per capita é a única
// fonte de verdade calculada (422bi / 212,58mi hab); todo o resto
// (Itumbiara, região) deriva DESSE número pra nunca dessincronizar entre
// si. Confere: 113.322 hab x R$1.985 ≈ R$225mi, bate com o validado.
const GMV_NACIONAL = 422_000_000_000;
const POPULACAO_BRASIL = 212_580_000;
const GMV_PER_CAPITA = Math.round(GMV_NACIONAL / POPULACAO_BRASIL); // ~R$1.985/hab/ano
const POPULACAO_ITUMBIARA = 113_322;
const IMPACTO_ITUMBIARA = Math.round(POPULACAO_ITUMBIARA * GMV_PER_CAPITA);

const MARKETPLACES = [
  'Amazon', 'Mercado Livre', 'Magazine Luiza', 'Shopee', 'Americanas',
  'Casas Bahia', 'Ponto Frio', 'Extra', 'Submarino', 'Netshoes',
];

const CIDADES_REGIAO = [
  { nome: 'Rio Verde', populacao: 245_000 },
  { nome: 'Itumbiara', populacao: POPULACAO_ITUMBIARA },
  { nome: 'Caldas Novas', populacao: 95_000 },
  { nome: 'Morrinhos', populacao: 48_000 },
  { nome: 'Goiatuba', populacao: 32_000 },
].map(c => ({ ...c, impacto: Math.round(c.populacao * GMV_PER_CAPITA) }));

const MAIOR_IMPACTO_REGIAO = Math.max(...CIDADES_REGIAO.map(c => c.impacto));
const TOTAL_REGIAO = CIDADES_REGIAO.reduce((soma, c) => soma + c.impacto, 0);

const IMPACTO_LOCAL = [
  'Fica circulando no comércio da cidade',
  'Gera emprego pra gente daqui',
  'Fortalece pequenos negócios locais',
  'Impostos financiam a cidade (ISS, IPTU...)',
];
const IMPACTO_NACIONAL = [
  'Sai de Itumbiara e não volta',
  'Não gera emprego local nenhum',
  'Enfraquece o comerciante da esquina',
  'Impostos vão pra outros municípios/estados',
];

function formatarBRLCompacto(v) {
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(2).replace('.', ',')} bilhões`;
  if (v >= 1_000_000) return `R$ ${Math.round(v / 1_000_000)} milhões`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`;
  return `R$ ${Math.round(v)}`;
}
function formatarInteiroBR(v) {
  return Math.round(v).toLocaleString('pt-BR');
}

// Dispara `true` (uma vez só) quando o elemento entra na viewport — base
// dos números que contam, fade-in de seção e barras que animam ao rolar.
function useEmTela(opcoes) {
  const ref = useRef(null);
  const [emTela, setEmTela] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setEmTela(true); obs.disconnect(); }
    }, opcoes);
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [ref, emTela];
}

function SecaoFadeIn({ children, className = '' }) {
  const [ref, emTela] = useEmTela({ threshold: 0.12 });
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${emTela ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}>
      {children}
    </div>
  );
}

// Número que conta de 0 até `valor` quando entra na tela (ease-out, ~1.6s).
function NumeroAnimado({ valor, formatar = formatarInteiroBR, className = '' }) {
  const [ref, emTela] = useEmTela({ threshold: 0.4 });
  const [atual, setAtual] = useState(0);
  useEffect(() => {
    if (!emTela) return;
    const duracaoMs = 1600;
    const inicio = performance.now();
    let frame;
    function tick(agora) {
      const progresso = Math.min((agora - inicio) / duracaoMs, 1);
      const facilitado = 1 - Math.pow(1 - progresso, 3);
      setAtual(valor * facilitado);
      if (progresso < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [emTela, valor]);
  return <span ref={ref} className={className}>{formatar(atual)}</span>;
}

function BarraRegional({ cidade }) {
  const [ref, emTela] = useEmTela({ threshold: 0.3 });
  const largura = (cidade.impacto / MAIOR_IMPACTO_REGIAO) * 100;
  return (
    <div ref={ref}>
      <div className="flex justify-between items-baseline text-sm sm:text-base mb-1.5">
        <span className="font-bold text-slate-800">{cidade.nome}</span>
        <span className="font-black" style={{ color: '#7C3AED' }}>{formatarBRLCompacto(cidade.impacto)}/ano</span>
      </div>
      <div className="h-3 sm:h-4 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-[1200ms] ease-out"
          style={{ width: emTela ? `${largura}%` : '0%', background: 'linear-gradient(90deg, #4C1D95, #7C3AED)' }}
        />
      </div>
      <p className="text-xs text-slate-400 mt-1">{formatarInteiroBR(cidade.populacao)} habitantes</p>
    </div>
  );
}

export default function Curiosidades() {
  const [cidadeSelecionada, setCidadeSelecionada] = useState(1); // índice 1 = Itumbiara
  const [populacaoCustom, setPopulacaoCustom] = useState('');
  const [percentual, setPercentual] = useState(15);

  const usandoOutra = cidadeSelecionada === 'outra';
  const populacaoAtual = usandoOutra ? (parseInt(populacaoCustom, 10) || 0) : CIDADES_REGIAO[cidadeSelecionada].populacao;
  const impactoAnualSelecionado = populacaoAtual * GMV_PER_CAPITA;
  const valorRecuperavel = impactoAnualSelecionado * (percentual / 100);

  return (
    <div className="min-h-screen bg-white">
      {/* Página standalone (sem TopNav completo — não faz sentido puxar
          busca/carrinho/favoritos pra um artigo institucional, e TopNav
          depende de CarrinhoProvider, que essa rota não tem). Sem isso o
          único jeito de sair era rolar até o CTA lá embaixo — usuário
          "ficava preso" (feedback real de teste). */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100 px-4 sm:px-6 h-12 flex items-center">
        <Link to="/marketplace" className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft size={16} weight="bold" /> Voltar ao Marketplace
        </Link>
      </div>

      {/* 1. HERO */}
      <section
        className="relative px-6 py-16 sm:py-24 text-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2D0A5C 0%, #4C1D95 55%, #7C3AED 130%)' }}
      >
        <div className="relative z-10 max-w-3xl mx-auto">
          <p className="text-[#FFB800] font-bold uppercase tracking-[3px] text-xs sm:text-sm mb-4">💡 Curiosidades IUB MAIS+</p>
          <h1 className="font-display font-black text-white leading-[1.05] text-3xl sm:text-5xl lg:text-6xl">
            O DINHEIRO QUE PODE ESTAR SAINDO DE ITUMBIARA
          </h1>
          <p className="text-white/80 text-base sm:text-xl mt-4 sm:mt-6">Uma reflexão sobre economia local</p>
        </div>
        <MascoteIubMais tamanho="large" animacao="float" className="relative z-10 mx-auto mt-8 sm:mt-10" />
      </section>

      {/* 2. INTRO */}
      <SecaoFadeIn className="max-w-2xl mx-auto px-6 py-12 sm:py-16 text-center">
        <p className="text-slate-700 text-lg sm:text-2xl leading-relaxed font-medium">
          Você já parou pra pensar quanto dinheiro sai de Itumbiara toda vez que alguém compra em marketplaces nacionais?
        </p>
        <p className="text-slate-500 text-base sm:text-lg mt-3">Vamos fazer as contas juntos.</p>
      </SecaoFadeIn>

      {/* 3. NÚMERO NACIONAL */}
      <SecaoFadeIn className="bg-slate-50 px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-display font-black text-[#FFB800] text-4xl sm:text-6xl lg:text-7xl" style={{ WebkitTextStroke: '1px #B87E00' }}>
            <NumeroAnimado
              valor={GMV_NACIONAL}
              formatar={v => `R$ ${(v / 1_000_000_000).toFixed(0)} BILHÕES`}
            />
          </p>
          <p className="text-slate-600 text-sm sm:text-lg mt-3 font-semibold">
            Movimentados pelos 10 maiores marketplaces em 2025
          </p>

          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {MARKETPLACES.map(nome => (
              <span key={nome} className="text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-full px-3.5 py-1.5 shadow-sm">
                {nome}
              </span>
            ))}
          </div>

          <p className="text-slate-400 text-xs sm:text-sm mt-6">Fonte: SBVC 2025</p>
        </div>
      </SecaoFadeIn>

      {/* 4. ITUMBIARA — destaque grande */}
      <SecaoFadeIn className="px-6 py-14 sm:py-20">
        <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-12 text-center">
          <p className="text-[#4C1D95] font-black uppercase tracking-wide text-sm sm:text-base">Itumbiara, GO</p>
          <p className="font-display font-black text-[#FFB800] mt-2 text-4xl sm:text-6xl lg:text-7xl leading-none">
            <NumeroAnimado valor={IMPACTO_ITUMBIARA} formatar={v => `R$ ${Math.round(v / 1_000_000)} MILHÕES`} />
          </p>
          <p className="text-slate-500 text-sm sm:text-base mt-2">por ano, saindo pra marketplaces nacionais</p>

          <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-8">
            {/* Valores exatos do material validado (base R$225mi redondo) —
                não eu recalculo em cima de IMPACTO_ITUMBIARA (R$224,94mi,
                antes de arredondar) pra não dar um "R$616 mil/dia" que
                diverge por arredondamento do número já aprovado. */}
            <div>
              <p className="font-display font-black text-slate-800 text-lg sm:text-2xl">R$ 18,8 mi</p>
              <p className="text-slate-400 text-[10px] sm:text-xs uppercase font-bold tracking-wide mt-1">por mês</p>
            </div>
            <div>
              <p className="font-display font-black text-slate-800 text-lg sm:text-2xl">R$ 617 mil</p>
              <p className="text-slate-400 text-[10px] sm:text-xs uppercase font-bold tracking-wide mt-1">por dia</p>
            </div>
            <div>
              <p className="font-display font-black text-slate-800 text-lg sm:text-2xl">R$ 26 mil</p>
              <p className="text-slate-400 text-[10px] sm:text-xs uppercase font-bold tracking-wide mt-1">por hora</p>
            </div>
          </div>

          <p className="text-slate-400 text-xs sm:text-sm mt-8">
            Fontes: SBVC 2025 (GMV top 10 marketplaces) · IBGE 2024 (população Brasil e Itumbiara) — proporcional per capita
          </p>
        </div>
      </SecaoFadeIn>

      {/* 5. REGIÃO SUL GOIANO */}
      <SecaoFadeIn className="bg-slate-50 px-6 py-14 sm:py-20">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display font-black text-slate-800 text-2xl sm:text-4xl text-center">Região Sul Goiano</h2>
          <p className="text-slate-500 text-center text-sm sm:text-base mt-2 mb-8 sm:mb-10">
            Não é só Itumbiara — a região inteira sangra dinheiro todo ano
          </p>

          <div className="space-y-5 sm:space-y-6">
            {CIDADES_REGIAO.map(cidade => <BarraRegional key={cidade.nome} cidade={cidade} />)}
          </div>

          <div className="mt-8 sm:mt-10 bg-[#4C1D95] rounded-2xl p-5 sm:p-7 text-center">
            <p className="text-white/70 text-xs sm:text-sm font-semibold uppercase tracking-wide">Total da região</p>
            <p className="font-display font-black text-[#FFB800] text-3xl sm:text-5xl mt-1">
              <NumeroAnimado valor={TOTAL_REGIAO} formatar={v => `R$ ${(v / 1_000_000_000).toFixed(2).replace('.', ',')} BI`} />
            </p>
            <p className="text-white/60 text-xs sm:text-sm mt-1">por ano</p>
          </div>
        </div>
      </SecaoFadeIn>

      {/* 6. CALCULADORA INTERATIVA */}
      <SecaoFadeIn className="px-6 py-14 sm:py-20">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display font-black text-slate-800 text-2xl sm:text-4xl text-center">Calcule pra sua cidade</h2>
          <p className="text-slate-500 text-center text-sm sm:text-base mt-2 mb-8">
            E se uma parte desse dinheiro voltasse a circular localmente?
          </p>

          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-5 sm:p-8">
            <label className="label">Cidade</label>
            <select
              value={cidadeSelecionada}
              onChange={e => setCidadeSelecionada(e.target.value === 'outra' ? 'outra' : Number(e.target.value))}
              className="input"
            >
              {CIDADES_REGIAO.map((c, i) => (
                <option key={c.nome} value={i}>{c.nome} ({formatarInteiroBR(c.populacao)} hab)</option>
              ))}
              <option value="outra">Outra cidade...</option>
            </select>

            {usandoOutra && (
              <div className="mt-3">
                <label className="label">População da cidade</label>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={populacaoCustom}
                  onChange={e => setPopulacaoCustom(e.target.value)}
                  placeholder="Ex.: 50000"
                  className="input"
                />
              </div>
            )}

            <div className="mt-5 sm:mt-6">
              <div className="flex justify-between items-baseline">
                <label className="label mb-0">% de recuperação pro comércio local</label>
                <span className="font-display font-black text-lg" style={{ color: '#4C1D95' }}>{percentual}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                step="1"
                value={percentual}
                onChange={e => setPercentual(Number(e.target.value))}
                className="w-full mt-2 accent-[#7C3AED]"
              />
              <div className="flex justify-between text-[10px] sm:text-xs text-slate-400 mt-1">
                <span>5%</span><span>30%</span>
              </div>
            </div>

            <div className="mt-6 sm:mt-8 bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] rounded-2xl p-5 sm:p-7 text-center">
              <p className="text-white/70 text-xs sm:text-sm font-semibold uppercase tracking-wide">Poderia ficar circulando localmente</p>
              <p className="font-display font-black text-[#FFB800] text-2xl sm:text-4xl mt-1.5 break-words">
                {populacaoAtual > 0 ? formatarBRLCompacto(valorRecuperavel) : 'R$ 0'}
              </p>
              <p className="text-white/60 text-xs sm:text-sm mt-1.5">por ano</p>
              {populacaoAtual > 0 && (
                <p className="text-white/50 text-[11px] sm:text-xs mt-3">
                  Base: {formatarInteiroBR(populacaoAtual)} hab × R$ {GMV_PER_CAPITA}/hab/ano = {formatarBRLCompacto(impactoAnualSelecionado)}/ano em potencial de mercado
                </p>
              )}
            </div>
          </div>
        </div>
      </SecaoFadeIn>

      {/* 7. IMPACTO REAL — comparativo */}
      <SecaoFadeIn className="bg-slate-50 px-6 py-14 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display font-black text-slate-800 text-2xl sm:text-4xl text-center mb-8 sm:mb-12">Onde esse dinheiro faz diferença</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <div className="bg-white rounded-2xl shadow-lg border-2 border-emerald-100 p-5 sm:p-7">
              <p className="font-display font-black text-emerald-600 text-base sm:text-lg mb-4">
                ✅ Cada R$ 1 milhão gasto localmente
              </p>
              <ul className="space-y-3">
                {IMPACTO_LOCAL.map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm sm:text-base text-slate-700">
                    <CheckCircle size={20} weight="fill" className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border-2 border-red-100 p-5 sm:p-7">
              <p className="font-display font-black text-red-500 text-base sm:text-lg mb-4">
                ❌ Cada R$ 1 milhão em marketplace nacional
              </p>
              <ul className="space-y-3">
                {IMPACTO_NACIONAL.map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm sm:text-base text-slate-700">
                    <XCircle size={20} weight="fill" className="text-red-400 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </SecaoFadeIn>

      {/* 9. CTA DUPLO (seção 8 - depoimento - fica pra depois, sem quote genérica fabricada) */}
      <SecaoFadeIn className="px-6 py-14 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display font-black text-slate-800 text-2xl sm:text-4xl text-center mb-8 sm:mb-12">
            Faça parte da mudança
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <div className="bg-gradient-to-br from-[#2D0A5C] to-[#4C1D95] rounded-3xl shadow-xl p-6 sm:p-8 text-center flex flex-col items-center">
              <MascoteIubMais tamanho="medium" animacao="float" />
              <ShoppingBag size={22} weight="fill" className="text-[#FFB800] mt-3" />
              <p className="font-display font-black text-white text-lg sm:text-2xl mt-2">Você é consumidor?</p>
              <p className="text-white/70 text-sm mt-2">Compre no comércio de Itumbiara e ajude o dinheiro a ficar aqui.</p>
              <Link
                to="/marketplace"
                className="inline-flex items-center gap-2 mt-5 text-sm sm:text-base font-black px-6 py-3 rounded-2xl shadow-lg hover:scale-[1.03] transition-transform"
                style={{ backgroundColor: '#FFB800', color: '#0F0F14' }}
              >
                EXPLORAR IUB MAIS+ <ArrowRight size={18} weight="bold" />
              </Link>
            </div>

            <div className="bg-gradient-to-br from-[#B87E00] to-[#FFB800] rounded-3xl shadow-xl p-6 sm:p-8 text-center flex flex-col items-center">
              <MascoteIubMais tamanho="medium" animacao="float" className="scale-x-[-1]" />
              <Storefront size={22} weight="fill" className="text-[#4C1D95] mt-3" />
              <p className="font-display font-black text-[#0F0F14] text-lg sm:text-2xl mt-2">Você é empresário?</p>
              <p className="text-[#3B2900] text-sm mt-2">Anuncie seu negócio e ajude a manter esse dinheiro em Itumbiara.</p>
              <Link
                to="/vender"
                className="inline-flex items-center gap-2 mt-5 text-sm sm:text-base font-black px-6 py-3 rounded-2xl shadow-lg hover:scale-[1.03] transition-transform text-white"
                style={{ backgroundColor: '#4C1D95' }}
              >
                SEJA UM PARCEIRO <ArrowRight size={18} weight="bold" />
              </Link>
            </div>
          </div>
        </div>
      </SecaoFadeIn>
    </div>
  );
}
