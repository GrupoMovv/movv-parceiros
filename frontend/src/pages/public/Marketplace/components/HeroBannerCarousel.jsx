import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import ModalEntrar from './ModalEntrar';
import { DOURADO } from '../theme';

const INTERVALO_MS = 5000;

function montarSlides(ehAssociado, onAbrirLogin) {
  return [
    {
      id: 'vender',
      emoji: '🎉',
      titulo: '100% Gratuito pra Comerciantes',
      texto: 'Cadastre sua empresa e comece a vender pra Itumbiara hoje mesmo.',
      gradiente: 'linear-gradient(135deg, #3B0A78 0%, #4C1D95 100%)',
      botao: 'Cadastrar minha empresa',
      to: '/vender',
    },
    ehAssociado ? null : {
      id: 'associado',
      emoji: '💎',
      titulo: 'Sou Associado SECI — Preço Especial',
      texto: 'Preço especial em todos os parceiros do marketplace.',
      gradiente: 'linear-gradient(135deg, #1F1F27 0%, #3B0A78 100%)',
      botao: 'Fazer login',
      onClick: onAbrirLogin,
    },
    {
      id: 'explorar',
      emoji: '🏆',
      titulo: 'Descubra o Comércio Local',
      texto: 'Produtos e serviços de Itumbiara, tudo num só lugar.',
      gradiente: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)',
      botao: 'Explorar produtos',
      href: '#ofertas',
    },
    {
      id: 'carteirinha',
      emoji: '🎫',
      titulo: 'Colaborador de Empresa Parceira?',
      texto: 'Ative sua carteirinha SECI + IUB MAIS em 2 minutos.',
      gradiente: 'linear-gradient(135deg, #0B1F3A 0%, #3B0A78 100%)',
      botao: 'Ativar carteirinha',
      to: '/cadastrar-associado',
    },
  ].filter(Boolean);
}

// Hero rotativo no topo da home — 4 chamadas institucionais/promocionais
// fixas (não vêm do backend), pra dar movimento visual logo na primeira
// dobra, antes das vitrines de produto. `associado` vem por prop (não
// chama useAssociadoSessao aqui) pra não disparar o fluxo de login por
// ?associado=hash em duplicidade com o Marketplace, que já usa o hook.
export default function HeroBannerCarousel({ associado }) {
  const navigate = useNavigate();
  const [indice, setIndice] = useState(0);
  const [modalLoginAberto, setModalLoginAberto] = useState(false);
  const timerRef = useRef(null);

  const slides = montarSlides(Boolean(associado), () => setModalLoginAberto(true));
  const total = slides.length;

  const pararAutoplay = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const iniciarAutoplay = useCallback(() => {
    pararAutoplay();
    if (total <= 1) return;
    timerRef.current = setInterval(() => setIndice(i => (i + 1) % total), INTERVALO_MS);
  }, [pararAutoplay, total]);

  useEffect(() => {
    iniciarAutoplay();
    return pararAutoplay;
  }, [iniciarAutoplay, pararAutoplay]);

  // slide "associado" pode entrar/sair da lista quando a sessão carrega —
  // evita ficar preso num índice que não existe mais.
  useEffect(() => { if (indice >= total) setIndice(0); }, [total, indice]);

  function irPara(i) {
    pararAutoplay();
    setIndice(((i % total) + total) % total);
    iniciarAutoplay();
  }

  function handleClickSlide(slide) {
    if (slide.onClick) return slide.onClick();
    if (slide.to) return navigate(slide.to);
    if (slide.href) document.querySelector(slide.href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (total === 0) return null;

  return (
    <section
      className="relative w-full overflow-hidden rounded-2xl h-[200px] sm:h-[300px] lg:h-[380px]"
      onMouseEnter={pararAutoplay}
      onMouseLeave={iniciarAutoplay}
    >
      <div
        className="flex h-full transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${indice * 100}%)` }}
      >
        {slides.map(slide => (
          <button
            key={slide.id}
            type="button"
            onClick={() => handleClickSlide(slide)}
            className="relative w-full h-full flex-shrink-0 flex items-center text-left px-6 sm:px-12 lg:px-16"
            style={{ background: slide.gradiente }}
          >
            <div className="relative max-w-lg">
              <p className="text-3xl sm:text-4xl">{slide.emoji}</p>
              <h2 className="text-white font-black text-lg sm:text-2xl lg:text-3xl tracking-tight mt-1.5 leading-tight">
                {slide.titulo}
              </h2>
              <p className="text-white/70 text-xs sm:text-sm mt-1.5 hidden sm:block">{slide.texto}</p>
              <span
                className="inline-block mt-3 sm:mt-4 text-xs sm:text-sm font-bold px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl"
                style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
              >
                {slide.botao}
              </span>
            </div>
          </button>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button" onClick={() => irPara(indice - 1)} aria-label="Slide anterior"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
          >
            <CaretLeft size={18} weight="bold" />
          </button>
          <button
            type="button" onClick={() => irPara(indice + 1)} aria-label="Próximo slide"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
          >
            <CaretRight size={18} weight="bold" />
          </button>

          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Ir para o slide ${i + 1}`}
                onClick={() => irPara(i)}
                className="h-1.5 rounded-full bg-white/40 transition-all duration-300"
                style={{ width: i === indice ? 20 : 6, backgroundColor: i === indice ? DOURADO : 'rgba(255,255,255,0.4)' }}
              />
            ))}
          </div>
        </>
      )}

      {modalLoginAberto && <ModalEntrar onClose={() => setModalLoginAberto(false)} />}
    </section>
  );
}
