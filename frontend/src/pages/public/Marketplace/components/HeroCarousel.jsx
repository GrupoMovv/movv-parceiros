import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
    destaqueDourado: true,
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

  useEffect(() => {
    const t = setInterval(proximo, 4500);
    return () => clearInterval(t);
  }, [proximo]);

  return (
    <div className="relative -mt-12 sm:-mt-14 max-w-5xl mx-auto px-4">
      <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{ height: 168 }}>
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className="absolute inset-0 flex items-center px-6 sm:px-10 transition-opacity duration-700"
            style={{ background: s.gradiente, opacity: i === ativo ? 1 : 0, pointerEvents: i === ativo ? 'auto' : 'none' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-lg sm:text-2xl leading-tight">{s.titulo}</p>
              <p className="text-white/80 text-xs sm:text-sm mt-1.5 max-w-xs">{s.texto}</p>
              {s.cta && (
                <Link
                  to="/cadastrar"
                  className="inline-block mt-3 text-xs sm:text-sm font-black px-4 py-2 rounded-xl transition-transform hover:scale-105"
                  style={{ backgroundColor: DOURADO, color: ROXO_ESCURO }}
                >
                  Quero ser associado →
                </Link>
              )}
            </div>
            <span className="hidden xs:block text-5xl sm:text-7xl opacity-90 flex-shrink-0 ml-2">{s.emoji}</span>
          </div>
        ))}
      </div>

      {/* indicadores */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setAtivo(i)}
            aria-label={`Slide ${i + 1}`}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: i === ativo ? 20 : 6, backgroundColor: i === ativo ? ROXO_ESCURO : '#D1D5DB' }}
          />
        ))}
      </div>
    </div>
  );
}
