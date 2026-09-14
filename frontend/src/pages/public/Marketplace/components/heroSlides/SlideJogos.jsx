import { useNavigate } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { MASCOTE_URL } from '../../../../../components/MascoteIubMais';

// Slide 2 do redesign — chama pro hub de joguinhos (/jogar: Roleta +
// Memória). Gradient roxo->dourado (identidade dos Joguinhos IUB MAIS+,
// mesma paleta de frontend/src/pages/public/Jogos).
export default function SlideJogos() {
  const navigate = useNavigate();

  return (
    <div
      className="relative w-full h-full flex items-center justify-center text-center overflow-hidden px-6"
      style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 55%, #B87E00 140%)' }}
    >
      <img
        src={MASCOTE_URL}
        alt=""
        className="hidden sm:block absolute h-[85%] left-[4%] lg:left-[8%] bottom-0 opacity-95 animate-hero-float"
        style={{ filter: 'drop-shadow(0 16px 24px rgba(0,0,0,0.35))' }}
      />

      <div className="relative z-10 max-w-lg sm:ml-[30%] lg:ml-[26%]">
        <p className="text-white font-black tracking-tight leading-[1.05] text-[26px] sm:text-4xl lg:text-5xl">
          🎡 SISTEMA DE JOGOS
        </p>
        <p className="font-black mt-2 text-lg sm:text-2xl lg:text-3xl" style={{ color: '#FFB800' }}>
          Ganhe cupom todo dia!
        </p>
        <p className="text-white/75 text-xs sm:text-sm mt-2 hidden sm:block">
          Roleta da Sorte pra ganhar desconto + Jogo da Memória sem limite pra se divertir.
        </p>

        <div className="flex items-center justify-center gap-3 mt-3 sm:mt-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-white bg-white/15 px-3 py-1.5 rounded-full">
            🎡 Roleta
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-white bg-white/15 px-3 py-1.5 rounded-full">
            🧠 Memória
          </span>
        </div>

        <button
          type="button"
          onClick={() => navigate('/jogar')}
          className="inline-flex items-center gap-2 mt-4 sm:mt-6 text-sm sm:text-base font-black px-6 sm:px-8 py-3 sm:py-4 rounded-2xl shadow-xl hover:scale-[1.03] transition-transform"
          style={{ backgroundColor: '#FFB800', color: '#0F0F14', boxShadow: '0 8px 24px rgba(255,184,0,0.4)' }}
        >
          🎡 JOGAR <ArrowRight size={18} weight="bold" />
        </button>
      </div>

      <style>{`
        @keyframes hero-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        .animate-hero-float { animation: hero-float 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
