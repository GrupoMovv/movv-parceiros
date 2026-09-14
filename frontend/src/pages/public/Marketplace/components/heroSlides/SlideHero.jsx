import { useNavigate } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { MASCOTE_URL } from '../../../../../components/MascoteIubMais';
import { DOURADO } from '../../theme';

// Slide 1 do redesign — hero institucional puro (nome + tagline + mascote),
// sem depender de dado nenhum vindo do backend (sempre pode aparecer).
export default function SlideHero() {
  const navigate = useNavigate();

  return (
    <div
      className="relative w-full h-full flex items-center overflow-hidden"
      style={{ background: 'linear-gradient(120deg, #2D0A5C 0%, #4C1D95 45%, #7C3AED 75%, #F5F0FF 130%)' }}
    >
      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 max-w-full sm:max-w-[58%]">
        <p className="text-white/60 text-[11px] sm:text-xs font-bold uppercase tracking-[3px]">O marketplace da nossa cidade</p>
        <h1 className="text-white font-black tracking-tight leading-[0.95] mt-2 text-[40px] sm:text-6xl lg:text-7xl" style={{ fontFamily: 'Poppins, sans-serif' }}>
          IUB<span style={{ color: DOURADO }}>MAIS+</span>
        </h1>
        <p className="text-white/85 font-semibold mt-2 text-lg sm:text-2xl lg:text-3xl" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Marketplace de Itumbiara
        </p>
        <button
          type="button"
          onClick={() => navigate('/marketplace')}
          className="inline-flex items-center gap-2 w-fit mt-5 sm:mt-7 text-sm sm:text-base font-black px-6 sm:px-8 py-3 sm:py-4 rounded-2xl shadow-xl hover:scale-[1.03] transition-transform"
          style={{ backgroundColor: DOURADO, color: '#0F0F14', boxShadow: '0 8px 24px rgba(255,184,0,0.35)' }}
        >
          Explorar loja <ArrowRight size={18} weight="bold" />
        </button>
      </div>

      <div className="hidden sm:flex flex-1 items-end justify-center h-full relative pb-0">
        <img
          src={MASCOTE_URL}
          alt=""
          className="h-[92%] object-contain animate-hero-float"
          style={{ filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.35))' }}
        />
      </div>

      <style>{`
        @keyframes hero-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        .animate-hero-float { animation: hero-float 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
