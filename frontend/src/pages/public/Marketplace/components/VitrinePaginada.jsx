import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import CardProdutoGrande from './CardProdutoGrande';
import { ROXO, DOURADO } from '../theme';
import { useColunas } from '../useColunas';

const INTERVALO_MS = 5000;
const LINHAS = 2;
const GRID_CLASSES = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="h-[130px] sm:h-[150px] xl:h-[180px] rounded-lg bg-slate-100" />
      <div className="h-2.5 bg-slate-100 rounded-full mt-2 w-1/2" />
      <div className="h-3 bg-slate-100 rounded-full mt-1.5 w-5/6" />
      <div className="h-4 bg-slate-100 rounded-full mt-1.5 w-2/3" />
    </div>
  );
}

// Grade paginada (setas + dots + auto-avanço) reaproveitada por TODAS as
// vitrines de produto da home — 2 fileiras, colunas responsivas (2 a 6,
// espelhando useColunas), 1 "página" = colunas x 2 produtos. Navegação por
// scroll nativo (funciona com swipe/touch de graça no mobile) — as setas e
// os dots só chamam scrollTo, o `aoRolar` mantém `paginaAtual` sincronizado
// mesmo quando o avanço vem de gesto manual, não só do timer/clique.
// Com poucos produtos (cabe tudo numa página só) setas/dots/autoplay somem
// sozinhos — não tem o que navegar.
export default function VitrinePaginada({ produtos, carregando, CardComponent = CardProdutoGrande, badge }) {
  const colunas = useColunas();
  const itensPorPagina = colunas * LINHAS;
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const trilhaRef = useRef(null);
  const timerRef = useRef(null);

  const paginas = useMemo(() => {
    if (produtos.length === 0) return [];
    const grupos = [];
    for (let i = 0; i < produtos.length; i += itensPorPagina) grupos.push(produtos.slice(i, i + itensPorPagina));
    return grupos;
  }, [produtos, itensPorPagina]);

  const totalPaginas = paginas.length;

  // Produtos ou nº de colunas (resize) podem mudar o total de páginas e
  // deixar a página atual apontando pra fora — corrige na hora.
  useEffect(() => { if (paginaAtual >= totalPaginas) setPaginaAtual(0); }, [totalPaginas, paginaAtual]);

  const pararAutoplay = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const irParaPagina = useCallback((pagina) => {
    const trilha = trilhaRef.current;
    if (!trilha || totalPaginas === 0) return;
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
    if (!carregando && totalPaginas > 0) iniciarAutoplay();
    return pararAutoplay;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, totalPaginas, pausado]);

  function aoRolar() {
    const trilha = trilhaRef.current;
    if (!trilha || trilha.clientWidth === 0) return;
    const pagina = Math.round(trilha.scrollLeft / trilha.clientWidth);
    setPaginaAtual(p => (p === pagina ? p : pagina));
  }

  // Clique manual em seta/dot reseta o timer do autoplay (chamando
  // iniciarAutoplay de novo) — pedido explícito: não pode "avançar de
  // novo sozinho" logo depois de um clique do usuário.
  function irParaPaginaManual(pagina) {
    const alvo = ((pagina % totalPaginas) + totalPaginas) % totalPaginas;
    setPaginaAtual(alvo);
    irParaPagina(alvo);
    iniciarAutoplay();
  }

  if (!carregando && produtos.length === 0) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      {totalPaginas > 1 && !carregando && (
        <button
          type="button" onClick={() => irParaPaginaManual(paginaAtual - 1)} aria-label="Página anterior"
          className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 xl:w-12 xl:h-12 rounded-full bg-white shadow-lg items-center justify-center hover:scale-105 transition-transform"
        >
          <CaretLeft size={18} weight="bold" color={ROXO} />
        </button>
      )}

      <div
        ref={trilhaRef}
        onScroll={aoRolar}
        className="flex overflow-x-auto scrollbar-none scroll-smooth"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {carregando ? (
          <div className={`grid ${GRID_CLASSES} gap-4 w-full flex-shrink-0`}>
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          paginas.map((pagina, i) => (
            <div key={i} className="w-full flex-shrink-0" style={{ scrollSnapAlign: 'start' }}>
              <div className={`grid ${GRID_CLASSES} gap-4 transition-opacity duration-500 ease-in-out ${i === paginaAtual ? 'opacity-100' : 'opacity-70'}`}>
                {pagina.map(p => <CardComponent key={p._key || p.id} produto={p} badge={badge} />)}
              </div>
            </div>
          ))
        )}
      </div>

      {totalPaginas > 1 && !carregando && (
        <button
          type="button" onClick={() => irParaPaginaManual(paginaAtual + 1)} aria-label="Próxima página"
          className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 xl:w-12 xl:h-12 rounded-full bg-white shadow-lg items-center justify-center hover:scale-105 transition-transform"
        >
          <CaretRight size={18} weight="bold" color={ROXO} />
        </button>
      )}

      {totalPaginas > 1 && !carregando && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {Array.from({ length: totalPaginas }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir para página ${i + 1}`}
              onClick={() => irParaPaginaManual(i)}
              className="h-1.5 w-6 rounded-full transition-colors"
              style={{ backgroundColor: i === paginaAtual ? DOURADO : '#E2E8F0' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
