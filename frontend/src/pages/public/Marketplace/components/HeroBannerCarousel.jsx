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
import SlideFood from './heroSlides/SlideFood';
import SlideBeer from './heroSlides/SlideBeer';
import { DOURADO } from '../theme';

const INTERVALO_MS = 5000;
const LIMIAR_SWIPE_PX = 40;

// Altura do carrossel varia por slide: Fecha Mês tem a própria altura,
// diferente dos outros. Desktop (620px) intocado desde sempre — o
// frame horizontal (ver SlideFechaMes.jsx) é calibrado em cima desse
// número, encolher quebraria o corte em monitores comuns (1280-1440px).
// Mobile foi ajustado de 250px pra 380px: a peça vertical dedicada
// (1080x1080) dimensiona pela LARGURA da tela agora, então precisa de
// slide mais alto pra caber sem sobrar barra roxa grande dos lados (250px
// deixava a imagem pequena — era isso que tinha ficado errado antes). 380
// foi escolhido calculando o preenchimento nos 3 tamanhos de teste
// (320/375/414px): 84%/99%/100% (corta só ~17px de cada lado em 414px,
// imperceptível) — o melhor equilíbrio dentro da faixa 380-420 pedida.
// Os slides de categoria usam a altura do redesign (280-300 mobile
// / 400-450 desktop), sem relação com o Fecha Mês. Hero/Jogos/Serviços/Food/Beer
// são arte pronta (ver SlideBannerArteBase): a altura acompanha a proporção da
// peça — 1:1 no mobile, 3:1 do sm pra cima — pra arte aparecer inteira.
// Em vw (não aspect-ratio) pra continuar animando a troca de altura; a
// barra de rolagem do desktop entra no vw, mas a diferença é de ~6px e o
// object-cover absorve.
const ALTURA_PADRAO = 'h-[290px] sm:h-[380px] lg:h-[440px]';
const ALTURA_FECHA_MES = 'h-[380px] sm:h-[480px] lg:h-[620px]';
const ALTURA_BANNER_ARTE = 'h-[100vw] sm:h-[33.34vw]';

// TODO (painel admin futuro, não implementado ainda):
//  - editor de slides do banner (texto, imagem, botão, ordem)
//  - upload de imagens customizadas por slide
//  - ativar/desativar slide específico sem precisar de deploy
//  - configurar intervalo do autoplay

// Banner hero full-width — orquestra só a mecânica do carrossel (autoplay,
// setas, dots, play/pause, swipe, contador); cada slide é um componente
// próprio em ./heroSlides. Ordem: Hero, Jogos, Serviços, Food, Beer, Fecha Mês,
// 3x Lojas Oficiais por categoria. Slides de categoria só entram se
// tiverem dado de verdade pra mostrar (ver `slides`). Cupons saiu do
// carrossel (destoava) — continua no sistema, só não é mais slide.
export default function HeroBannerCarousel({ fechaMesInfo }) {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [masterPorCategoria, setMasterPorCategoria] = useState({ beleza: [], saude: [], fitness: [] });
  const timerRef = useRef(null);
  const touchStartXRef = useRef(null);

  useEffect(() => {
    api.get('/public/parceiros/master-por-categoria').then(res => setMasterPorCategoria(res.data)).catch(() => {});
  }, []);

  // Fecha Mês entra no carrossel só faltando <= 20 dias (nunca no dia em
  // si — aí quem assume é o banner full-width do topo, ver
  // FechaMesBanner/Marketplace.jsx). Nos últimos 3 dias vira o slide
  // principal (posição 1); antes disso fica na posição 6 (depois do Beer).
  const diasRestantes = fechaMesInfo?.dias_restantes;
  const mostrarFechaMes = fechaMesInfo?.habilitado_globalmente && !fechaMesInfo?.ativo_hoje
    && diasRestantes != null && diasRestantes > 0 && diasRestantes <= 20;
  const fechaMesEhPrincipal = mostrarFechaMes && diasRestantes <= 3;
  const slideFechaMes = mostrarFechaMes && {
    id: 'fecha-mes', Componente: SlideFechaMes, props: { info: fechaMesInfo }, cor: DOURADO, altura: ALTURA_FECHA_MES,
  };

  const slides = useMemo(() => {
    const base = [
      { id: 'hero', Componente: SlideHero, props: {}, cor: DOURADO, altura: ALTURA_BANNER_ARTE },
      { id: 'jogos', Componente: SlideJogos, props: {}, cor: '#FFB800', altura: ALTURA_BANNER_ARTE },
      { id: 'servicos', Componente: SlideServicos, props: {}, cor: '#FFB800', altura: ALTURA_BANNER_ARTE },
      { id: 'food', Componente: SlideFood, props: {}, cor: '#FFB800', altura: ALTURA_BANNER_ARTE },
      { id: 'beer', Componente: SlideBeer, props: {}, cor: '#A78BFA', altura: ALTURA_BANNER_ARTE },
      !fechaMesEhPrincipal && slideFechaMes,
      masterPorCategoria.beleza.length > 0 && { id: 'categoria-beleza', Componente: SlideCategoriaBeleza, props: { lojas: masterPorCategoria.beleza }, cor: '#EC4899' },
      masterPorCategoria.saude.length > 0 && { id: 'categoria-saude', Componente: SlideCategoriaSaude, props: { lojas: masterPorCategoria.saude }, cor: '#10B981' },
      masterPorCategoria.fitness.length > 0 && { id: 'categoria-fitness', Componente: SlideCategoriaFitness, props: { lojas: masterPorCategoria.fitness }, cor: '#F97316' },
    ].filter(Boolean);
    return fechaMesEhPrincipal ? [slideFechaMes, ...base] : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterPorCategoria, fechaMesEhPrincipal, mostrarFechaMes, diasRestantes]);

  const total = slides.length;

  // slides que só entram depois que o próprio fetch resolve (categoria)
  // podem deixar o índice atual apontando pra fora da lista —
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

  const alturaAtual = slides[indice]?.altura || ALTURA_PADRAO;

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
