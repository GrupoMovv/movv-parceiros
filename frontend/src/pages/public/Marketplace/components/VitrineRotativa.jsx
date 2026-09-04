import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaretLeft, CaretRight, Fire } from '@phosphor-icons/react';
import api from '../../../../services/api';
import CardVitrineRotativa from './CardVitrineRotativa';
import { PRETO, ROXO } from '../theme';

const INTERVALO_MS = 5000;
const LARGURA_CARD = 'w-[calc((100%-1.5rem)/2)] sm:w-[calc((100%-3rem)/3)] lg:w-[calc((100%-4.5rem)/4)]';

// 2 no mobile / 3 no tablet / 4 no desktop — espelha exatamente as larguras
// dos cards em LARGURA_CARD, usado só pra calcular quantas "páginas" (dots)
// existem e destacar a página atual.
function useVisibleCount() {
  const [count, setCount] = useState(() => (typeof window === 'undefined' ? 4 : calcular()));

  function calcular() {
    if (window.matchMedia('(min-width: 1024px)').matches) return 4;
    if (window.matchMedia('(min-width: 640px)').matches) return 3;
    return 2;
  }

  useEffect(() => {
    function aoRedimensionar() { setCount(calcular()); }
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);

  return count;
}

// Enquanto o catálogo é pequeno, uma vitrine com só 1-2 produtos não passa
// sensação nenhuma de "rotativo" (nem dá pra rolar). Repete a lista (com
// key própria por cópia) até ter pelo menos 2 páginas cheias, num teto de
// 3 repetições — só um efeito visual de movimento, nunca finge ter mais
// produtos distintos do que realmente existem (mesmo produto, mesmo link).
function comMovimentoGarantido(produtos, visiveis) {
  if (produtos.length === 0) return produtos;
  const minimo = visiveis * 2;
  if (produtos.length >= minimo) return produtos;

  const repeticoes = Math.min(3, Math.ceil(minimo / produtos.length));
  const resultado = [];
  for (let copia = 0; copia < repeticoes; copia++) {
    for (const p of produtos) resultado.push({ ...p, _key: `${p.id}-${copia}` });
  }
  return resultado;
}

function SkeletonCard() {
  return (
    <div className={`${LARGURA_CARD} flex-shrink-0 animate-pulse`}>
      <div className="h-[200px] sm:h-[240px] lg:h-[260px] rounded-lg bg-slate-100" />
      <div className="h-3 bg-slate-100 rounded-full mt-3 w-5/6" />
      <div className="h-3 bg-slate-100 rounded-full mt-2 w-1/2" />
      <div className="h-5 bg-slate-100 rounded-full mt-2 w-2/3" />
    </div>
  );
}

// Vitrine única onde TODOS os parceiros aparecem (não é "destaque premium"
// separado de "destaque master") — quem tem plano maior só contribui mais
// produtos pra fila do round-robin do backend. Carrossel com scroll nativo
// (funciona com swipe/touch de graça), autoplay pausado no hover, setas e
// dots com barrinha de progresso — ver vitrineRotativaService.js pro
// algoritmo de distribuição.
export default function VitrineRotativa() {
  const [produtosBrutos, setProdutosBrutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const trilhaRef = useRef(null);
  const timerRef = useRef(null);
  const visiveis = useVisibleCount();

  const produtos = useMemo(() => comMovimentoGarantido(produtosBrutos, visiveis), [produtosBrutos, visiveis]);
  const totalPaginas = Math.max(1, Math.ceil(produtos.length / visiveis));

  useEffect(() => {
    api.get('/public/marketplace/vitrine-rotativa')
      .then(res => setProdutosBrutos(res.data.produtos))
      .catch(() => setProdutosBrutos([]))
      .finally(() => setCarregando(false));
  }, []);

  const pararAutoplay = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const irParaPagina = useCallback((pagina) => {
    const trilha = trilhaRef.current;
    if (!trilha) return;
    const alvo = ((pagina % totalPaginas) + totalPaginas) % totalPaginas;
    trilha.scrollTo({ left: alvo * trilha.clientWidth, behavior: 'smooth' });
  }, [totalPaginas]);

  const iniciarAutoplay = useCallback(() => {
    pararAutoplay();
    if (totalPaginas <= 1 || pausado) return;
    timerRef.current = setInterval(() => {
      setPaginaAtual(p => {
        const proxima = (p + 1) % totalPaginas;
        irParaPagina(proxima);
        return proxima;
      });
    }, INTERVALO_MS);
  }, [pararAutoplay, irParaPagina, totalPaginas, pausado]);

  useEffect(() => {
    if (!carregando && produtos.length > 0) iniciarAutoplay();
    return pararAutoplay;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, produtos.length, visiveis, pausado]);

  // Mantém os dots corretos mesmo quando o avanço vem de swipe manual
  // (não só do timer/setas) — throttle simples via rAF em vez de debounce
  // com timeout, pra atualizar durante o próprio gesto de scroll.
  function aoRolar() {
    const trilha = trilhaRef.current;
    if (!trilha || trilha.clientWidth === 0) return;
    const pagina = Math.round(trilha.scrollLeft / trilha.clientWidth);
    setPaginaAtual(p => (p === pagina ? p : pagina));
  }

  function handleSeta(direcao) {
    const proxima = paginaAtual + direcao;
    setPaginaAtual(((proxima % totalPaginas) + totalPaginas) % totalPaginas);
    irParaPagina(proxima);
  }

  if (!carregando && produtos.length === 0) return null;

  return (
    <section
      className="relative"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="flex items-center gap-2 text-2xl md:text-3xl font-bold tracking-tight" style={{ color: PRETO }}>
            <Fire size={26} weight="duotone" color={ROXO} /> Produtos em Destaque
          </h2>
          <p className="text-sm text-slate-400 mt-1">Produtos dos nossos parceiros aparecendo para você</p>
        </div>
      </div>

      <div className="relative">
        {totalPaginas > 1 && !carregando && (
          <button
            type="button" onClick={() => handleSeta(-1)} aria-label="Anterior"
            className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center hover:scale-105 transition-transform"
          >
            <CaretLeft size={18} weight="bold" color={ROXO} />
          </button>
        )}

        <div
          ref={trilhaRef}
          onScroll={aoRolar}
          className="flex gap-6 overflow-x-auto scrollbar-none scroll-smooth"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {carregando
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : produtos.map((p, i) => (
              <div key={p._key || p.id || i} className={`${LARGURA_CARD} flex-shrink-0`} style={{ scrollSnapAlign: 'start' }}>
                <CardVitrineRotativa produto={p} />
              </div>
            ))}
        </div>

        {totalPaginas > 1 && !carregando && (
          <button
            type="button" onClick={() => handleSeta(1)} aria-label="Próximo"
            className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center hover:scale-105 transition-transform"
          >
            <CaretRight size={18} weight="bold" color={ROXO} />
          </button>
        )}
      </div>

      {totalPaginas > 1 && !carregando && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {Array.from({ length: totalPaginas }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir para página ${i + 1}`}
              onClick={() => { setPaginaAtual(i); irParaPagina(i); }}
              className="relative h-1.5 w-6 rounded-full bg-slate-200 overflow-hidden"
            >
              {i === paginaAtual && (
                <span
                  key={paginaAtual}
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    backgroundColor: ROXO,
                    animation: `preencherDot ${INTERVALO_MS}ms linear forwards`,
                    animationPlayState: pausado ? 'paused' : 'running',
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      <style>{`@keyframes preencherDot { from { width: 0%; } to { width: 100%; } }`}</style>
    </section>
  );
}
