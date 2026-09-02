import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DOURADO, ROXO_ESCURO } from '../theme';

const SLIDES = [
  {
    titulo: 'Comércio local, benefícios especiais',
    texto: 'Conheça os parceiros que fazem parte da nossa comunidade',
    gradiente: 'linear-gradient(135deg, #3B0A78 0%, #6D28D9 100%)',
    emoji: '🏪',
  },
  {
    titulo: 'Ofertas EXCLUSIVAS pra associados',
    texto: 'Descontos que só quem tem carteirinha SECI consegue',
    gradiente: 'linear-gradient(135deg, #7C2D12 0%, #B87E00 55%, #FFB800 100%)',
    emoji: '💎',
  },
  {
    titulo: 'Vire associado gratuitamente',
    texto: 'Cadastre-se em minutos e desbloqueie todos os benefícios',
    gradiente: 'linear-gradient(135deg, #4C1D95 0%, #9333EA 100%)',
    emoji: '✨',
    cta: true,
  },
];

export default function HeroCarousel() {
  const [ativo, setAtivo] = useState(0);

  const proximo = useCallback(() => {
    setAtivo((i) => (i + 1) % SLIDES.length);
  }, []);

  const anterior = useCallback(() => {
    setAtivo((i) => (i - 1 + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    const t = setInterval(proximo, 5000);
    return () => clearInterval(t);
  }, [proximo, ativo]);

  return (
    <div className="relative -mt-12 sm:-mt-14 w-full max-w-5xl mx-auto px-4">
      <div className="relative w-full h-60 md:h-80 lg:h-[420px] rounded-[2rem] overflow-hidden shadow-2xl">
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className="absolute inset-0 w-full h-full flex items-center px-6 sm:px-12 lg:px-16 transition-opacity duration-700"
            style={{ background: s.gradiente, opacity: i === ativo ? 1 : 0, pointerEvents: i === ativo ? 'auto' : 'none' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-2xl sm:text-4xl lg:text-5xl leading-tight max-w-md">{s.titulo}</p>
              <p className="text-white/85 text-sm sm:text-lg mt-2 sm:mt-3 max-w-sm">{s.texto}</p>
              {s.cta && (
                <Link
                  to="/cadastrar"
                  className="inline-block mt-4 sm:mt-6 text-sm sm:text-base font-black px-5 sm:px-7 py-2.5 sm:py-3.5 rounded-xl transition-transform hover:scale-105"
                  style={{ backgroundColor: DOURADO, color: ROXO_ESCURO }}
                >
                  Quero ser associado →
                </Link>
              )}
            </div>
            <span className="hidden sm:block text-7xl lg:text-9xl opacity-90 flex-shrink-0 ml-4">{s.emoji}</span>
          </div>
        ))}

        {/* setas — so no desktop */}
        <button
          type="button"
          onClick={anterior}
          aria-label="Slide anterior"
          className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur-sm items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <button
          type="button"
          onClick={proximo}
          aria-label="Próximo slide"
          className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur-sm items-center justify-center transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* indicadores */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setAtivo(i)}
            aria-label={`Slide ${i + 1}`}
            className="h-2.5 rounded-full transition-all duration-300"
            style={{ width: i === ativo ? 28 : 10, backgroundColor: i === ativo ? ROXO_ESCURO : '#D1D5DB' }}
          />
        ))}
      </div>
    </div>
  );
}
