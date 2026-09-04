import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaretLeft, CaretRight, Play, Pause } from '@phosphor-icons/react';
import api from '../../../../services/api';
import ModalEntrar from './ModalEntrar';
import SlideInstitucional from './heroSlides/SlideInstitucional';
import SlideProdutosDestaque from './heroSlides/SlideProdutosDestaque';
import SlideComerciantes from './heroSlides/SlideComerciantes';
import SlideAssociados from './heroSlides/SlideAssociados';
import SlideColaboradores from './heroSlides/SlideColaboradores';
import { DOURADO } from '../theme';

const INTERVALO_MS = 6500;

// TODO (painel admin futuro, não implementado ainda):
//  - editor de slides do banner (texto, imagem, botão, ordem)
//  - upload de imagens customizadas por slide
//  - ativar/desativar slide específico sem precisar de deploy
//  - configurar intervalo do autoplay

// Banner hero full-width — orquestra só a mecânica do carrossel (autoplay,
// setas, dots, play/pause, contador); cada slide é um componente próprio em
// ./heroSlides, alguns com dado real buscado aqui uma vez só (produtos
// exclusivos, empresas da lista aprovada, total de parceiros) e passado
// por prop, pra não competir com o timer do carrossel nem duplicar fetch.
// `associado` vem por prop (não chama useAssociadoSessao aqui) pra não
// disparar o fluxo de login por ?associado=hash em duplicidade com quem
// já usa o hook (Marketplace.jsx).
export default function HeroBannerCarousel({ associado }) {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [modalLoginAberto, setModalLoginAberto] = useState(false);
  const [produtosDestaque, setProdutosDestaque] = useState([]);
  const [empresasParceiras, setEmpresasParceiras] = useState([]);
  const [totalParceiros, setTotalParceiros] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    api.get('/public/marketplace/exclusivos-associados').then(res => setProdutosDestaque(res.data.produtos || [])).catch(() => {});
    api.get('/public/marketplace/empresas-parceiras').then(res => setEmpresasParceiras(res.data.empresas || [])).catch(() => {});
    api.get('/public/marketplace/stats').then(res => setTotalParceiros(res.data.parceiros)).catch(() => {});
  }, []);

  const slides = useMemo(() => [
    { id: 'institucional', Componente: SlideInstitucional, props: {} },
    produtosDestaque.length > 0 && { id: 'produtos', Componente: SlideProdutosDestaque, props: { produtos: produtosDestaque } },
    { id: 'comerciantes', Componente: SlideComerciantes, props: { totalParceiros } },
    !associado && { id: 'associados', Componente: SlideAssociados, props: { onAbrirLogin: () => setModalLoginAberto(true) } },
    empresasParceiras.length > 0 && { id: 'colaboradores', Componente: SlideColaboradores, props: { empresas: empresasParceiras } },
  ].filter(Boolean), [produtosDestaque, empresasParceiras, totalParceiros, associado]);

  const total = slides.length;

  // slides que só entram depois que o próprio fetch resolve (produtos,
  // colaboradores) ou saem quando a sessão de associado carrega podem
  // deixar o índice atual apontando pra fora da lista — corrige na hora.
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

  if (total === 0) return null;

  return (
    <section
      className="relative w-full h-[250px] sm:h-[480px] lg:h-[620px] overflow-hidden"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
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
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white/25 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
          >
            <CaretLeft size={20} weight="bold" />
          </button>
          <button
            type="button" onClick={() => irPara(indice + 1)} aria-label="Próximo slide"
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white/25 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
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
                      backgroundColor: DOURADO,
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

      {modalLoginAberto && <ModalEntrar onClose={() => setModalLoginAberto(false)} />}

      <style>{`@keyframes preencherHero { from { width: 0%; } to { width: 100%; } }`}</style>
    </section>
  );
}
