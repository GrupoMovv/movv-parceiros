import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaretLeft, CaretRight, Play, Pause } from '@phosphor-icons/react';
import api from '../../../../services/api';
import SlideHero from './heroSlides/SlideHero';
import SlideJogos from './heroSlides/SlideJogos';
import SlideServicos from './heroSlides/SlideServicos';
import SlideCategoriaBeleza from './heroSlides/SlideCategoriaBeleza';
import SlideCategoriaSaude from './heroSlides/SlideCategoriaSaude';
import SlideCategoriaFitness from './heroSlides/SlideCategoriaFitness';
import SlideFechaMes from './heroSlides/SlideFechaMes';
import SlideCupons from './heroSlides/SlideCupons';
import { DOURADO } from '../theme';

const INTERVALO_MS = 5000;
const LIMIAR_SWIPE_PX = 40;

// Altura do carrossel varia por slide: Fecha Mês mantém exatamente a
// mesma altura de sempre (620px desktop) porque o frame dele (ver
// SlideFechaMes.jsx) é calibrado em cima desse número — encolher a
// section pra caber a "altura consistente" pedida pros slides novos
// faria a arte do Fecha Mês cortar em monitores comuns (1280-1440px),
// sem precisar tocar no arquivo dele. Os 6 slides novos usam a altura
// nova (280-300 mobile / 400-450 desktop pedida no redesign).
const ALTURA_PADRAO = 'h-[290px] sm:h-[380px] lg:h-[440px]';
const ALTURA_FECHA_MES = 'h-[250px] sm:h-[480px] lg:h-[620px]';

// TODO (painel admin futuro, não implementado ainda):
//  - editor de slides do banner (texto, imagem, botão, ordem)
//  - upload de imagens customizadas por slide
//  - ativar/desativar slide específico sem precisar de deploy
//  - configurar intervalo do autoplay

// Banner hero full-width — orquestra só a mecânica do carrossel (autoplay,
// setas, dots, play/pause, swipe, contador); cada slide é um componente
// próprio em ./heroSlides. Redesign (Hero, Jogos, Serviços, 3x Lojas
// Oficiais por categoria, Fecha Mês, Cupons) — slides de categoria e o de
// cupons só entram se tiverem dado de verdade pra mostrar (ver `slides`);
// Serviços é fixo igual Hero/Jogos, não depende de nada do backend.
export default function HeroBannerCarousel({ fechaMesInfo }) {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [masterPorCategoria, setMasterPorCategoria] = useState({ beleza: [], saude: [], fitness: [] });
  const [cuponsDisponiveis, setCuponsDisponiveis] = useState({ total: 0, amostra: [] });
  const timerRef = useRef(null);
  const touchStartXRef = useRef(null);

  useEffect(() => {
    api.get('/public/parceiros/master-por-categoria').then(res => setMasterPorCategoria(res.data)).catch(() => {});
    api.get('/public/cupons/disponiveis').then(res => setCuponsDisponiveis(res.data)).catch(() => {});
  }, []);

  // Fecha Mês entra no carrossel só faltando <= 20 dias (nunca no dia em
  // si — aí quem assume é o banner full-width do topo, ver
  // FechaMesBanner/Marketplace.jsx). Nos últimos 3 dias vira o slide
  // principal (posição 1); antes disso fica na posição 6 (antes de Cupons).
  const diasRestantes = fechaMesInfo?.dias_restantes;
  const mostrarFechaMes = fechaMesInfo?.habilitado_globalmente && !fechaMesInfo?.ativo_hoje
    && diasRestantes != null && diasRestantes > 0 && diasRestantes <= 20;
  const fechaMesEhPrincipal = mostrarFechaMes && diasRestantes <= 3;
  const slideFechaMes = mostrarFechaMes && {
    id: 'fecha-mes', Componente: SlideFechaMes, props: { info: fechaMesInfo }, cor: DOURADO, alturaClassica: true,
  };

  const slides = useMemo(() => {
    const base = [
      { id: 'hero', Componente: SlideHero, props: {}, cor: DOURADO },
      { id: 'jogos', Componente: SlideJogos, props: {}, cor: '#FFB800' },
      { id: 'servicos', Componente: SlideServicos, props: {}, cor: '#FFB800' },
      masterPorCategoria.beleza.length > 0 && { id: 'categoria-beleza', Componente: SlideCategoriaBeleza, props: { lojas: masterPorCategoria.beleza }, cor: '#EC4899' },
      masterPorCategoria.saude.length > 0 && { id: 'categoria-saude', Componente: SlideCategoriaSaude, props: { lojas: masterPorCategoria.saude }, cor: '#10B981' },
      masterPorCategoria.fitness.length > 0 && { id: 'categoria-fitness', Componente: SlideCategoriaFitness, props: { lojas: masterPorCategoria.fitness }, cor: '#F97316' },
      !fechaMesEhPrincipal && slideFechaMes,
      cuponsDisponiveis.total > 0 && { id: 'cupons', Componente: SlideCupons, props: cuponsDisponiveis, cor: DOURADO },
    ].filter(Boolean);
    return fechaMesEhPrincipal ? [slideFechaMes, ...base] : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterPorCategoria, cuponsDisponiveis, fechaMesEhPrincipal, mostrarFechaMes, diasRestantes]);

  const total = slides.length;

  // slides que só entram depois que o próprio fetch resolve (categoria,
  // cupons) podem deixar o índice atual apontando pra fora da lista —
  // corrige na hora.
  useEffect(() => { if (indice >= total) setIndice(0); }, [total, indice]);

  const pararAutoplay = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const iniciarAutoplay = useCallback(() => {
    pararAutoplay();
    if (total <= 1 || pausado) return;
    timerRef.current = setInterval(() => setIndice(i => (i + 1) % total), INTERVALO_MS);
  }, [pararAutoplay, total, pausado]);

  useEffect(() => {
    iniciarAutoplay();
    return pararAutoplay;
  }, [iniciarAutoplay, pararAutoplay]);

  function irPara(i) {
    setIndice(((i % total) + total) % total);
  }

  function handleTouchStart(e) {
    touchStartXRef.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    if (touchStartXRef.current == null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (deltaX > LIMIAR_SWIPE_PX) irPara(indice - 1);
    else if (deltaX < -LIMIAR_SWIPE_PX) irPara(indice + 1);
  }

  if (total === 0) return null;

  const alturaAtual = slides[indice]?.alturaClassica ? ALTURA_FECHA_MES : ALTURA_PADRAO;

  return (
    <section
      className={`relative w-full ${alturaAtual} overflow-hidden transition-[height] duration-500`}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex h-full transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${indice * 100}%)` }}
      >
        {slides.map(({ id, Componente, props }) => (
          <div key={id} className="w-full h-full flex-shrink-0">
            <Componente {...props} />
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button" onClick={() => irPara(indice - 1)} aria-label="Slide anterior"
            className="hidden sm:flex absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white/25 hover:bg-white/40 backdrop-blur-sm items-center justify-center text-white transition-colors"
          >
            <CaretLeft size={20} weight="bold" />
          </button>
          <button
            type="button" onClick={() => irPara(indice + 1)} aria-label="Próximo slide"
            className="hidden sm:flex absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white/25 hover:bg-white/40 backdrop-blur-sm items-center justify-center text-white transition-colors"
          >
            <CaretRight size={20} weight="bold" />
          </button>

          <button
            type="button"
            onClick={() => setPausado(p => !p)}
            aria-label={pausado ? 'Retomar rotação' : 'Pausar rotação'}
            className="absolute left-3 sm:left-5 bottom-3 sm:bottom-4 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/25 hover:bg-black/40 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
          >
            {pausado ? <Play size={13} weight="fill" /> : <Pause size={13} weight="fill" />}
          </button>

          <span className="absolute right-3 sm:right-5 bottom-3 sm:bottom-4 z-10 text-[11px] sm:text-xs font-bold text-white bg-black/25 px-2.5 py-1 rounded-full backdrop-blur-sm">
            {indice + 1} / {total}
          </span>

          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Ir para o slide ${i + 1}`}
                onClick={() => irPara(i)}
                className="relative h-1.5 w-7 rounded-full bg-white/30 overflow-hidden"
              >
                {i === indice && (
                  <span
                    key={indice}
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      backgroundColor: slide.cor || DOURADO,
                      animation: `preencherHero ${INTERVALO_MS}ms linear forwards`,
                      animationPlayState: pausado ? 'paused' : 'running',
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </>
      )}

      <style>{`@keyframes preencherHero { from { width: 0%; } to { width: 100%; } }`}</style>
    </section>
  );
}
