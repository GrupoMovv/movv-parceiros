import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Fire } from '@phosphor-icons/react';
import api from '../../../../services/api';
import CardVitrineRotativa from './CardVitrineRotativa';
import { PRETO, ROXO } from '../theme';

const INTERVALO_MS = 5000;
const LARGURA_CARD = 'w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-1.5rem)/3)] lg:w-[calc((100%-3rem)/5)]';

// 2 no mobile / 3 no tablet / 5 no desktop — espelha exatamente as larguras
// dos cards em LARGURA_CARD, usado só pra calcular quantas "páginas" (dots)
// existem e destacar a página atual.
function useVisibleCount() {
  const [count, setCount] = useState(() => (typeof window === 'undefined' ? 5 : calcular()));

  function calcular() {
    if (window.matchMedia('(min-width: 1024px)').matches) return 5;
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

function SkeletonCard() {
  return (
    <div className={`${LARGURA_CARD} flex-shrink-0 animate-pulse`}>
      <div className="h-[140px] sm:h-[180px] rounded-md bg-slate-100" />
      <div className="h-3.5 bg-slate-100 rounded-full mt-2 w-5/6" />
      <div className="h-2.5 bg-slate-100 rounded-full mt-1.5 w-1/2" />
      <div className="h-4 bg-slate-100 rounded-full mt-1.5 w-2/3" />
    </div>
  );
}

// Vitrine única onde TODOS os parceiros aparecem (não é "destaque premium"
// separado de "destaque master") — quem tem plano maior só contribui mais
// produtos pra fila do round-robin do backend. Carrossel com scroll nativo
// (funciona com swipe/touch de graça), autoplay pausado no hover, setas e
// dots — ver vitrineRotativaService.js pro algoritmo de distribuição.
export default function VitrineRotativa() {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(0);
  const trilhaRef = useRef(null);
  const timerRef = useRef(null);
  const visiveis = useVisibleCount();
  const totalPaginas = Math.max(1, Math.ceil(produtos.length / visiveis));

  useEffect(() => {
    api.get('/public/marketplace/vitrine-rotativa')
      .then(res => setProdutos(res.data.produtos))
      .catch(() => setProdutos([]))
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
    if (totalPaginas <= 1) return;
    timerRef.current = setInterval(() => {
      setPaginaAtual(p => {
        const proxima = (p + 1) % totalPaginas;
        irParaPagina(proxima);
        return proxima;
      });
    }, INTERVALO_MS);
  }, [pararAutoplay, irParaPagina, totalPaginas]);

  useEffect(() => {
    if (!carregando && produtos.length > 0) iniciarAutoplay();
    return pararAutoplay;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, produtos.length, visiveis]);

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
    pararAutoplay();
    const proxima = paginaAtual + direcao;
    setPaginaAtual(((proxima % totalPaginas) + totalPaginas) % totalPaginas);
    irParaPagina(proxima);
    iniciarAutoplay();
  }

  if (!carregando && produtos.length === 0) return null;

  return (
    <section
      className="relative"
      onMouseEnter={pararAutoplay}
      onMouseLeave={iniciarAutoplay}
    >
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-lg font-bold tracking-tight" style={{ color: PRETO }}>
            <Fire size={20} weight="duotone" color={ROXO} /> Produtos em Destaque
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Produtos dos nossos parceiros aparecendo para você</p>
        </div>
        {totalPaginas > 1 && !carregando && (
          <div className="hidden sm:flex items-center gap-1.5">
            <button type="button" onClick={() => handleSeta(-1)} aria-label="Anterior" className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => handleSeta(1)} aria-label="Próximo" className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={trilhaRef}
        onScroll={aoRolar}
        className="flex gap-3 overflow-x-auto scrollbar-none scroll-smooth"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {carregando
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : produtos.map(p => (
            <div key={p.id} className={`${LARGURA_CARD} flex-shrink-0`} style={{ scrollSnapAlign: 'start' }}>
              <CardVitrineRotativa produto={p} />
            </div>
          ))}
      </div>

      {totalPaginas > 1 && !carregando && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {Array.from({ length: totalPaginas }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir para página ${i + 1}`}
              onClick={() => { pararAutoplay(); setPaginaAtual(i); irParaPagina(i); iniciarAutoplay(); }}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === paginaAtual ? 18 : 6, backgroundColor: i === paginaAtual ? ROXO : '#E2E8F0' }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
