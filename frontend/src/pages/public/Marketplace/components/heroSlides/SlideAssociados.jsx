import { Diamond, IdentificationCard } from '@phosphor-icons/react';
import { ROXO, PRETO } from '../../theme';

// Slide 4 — associado SECI, com um "mockup" de celular em CSS puro (sem
// imagem externa) mostrando uma prévia da carteirinha digital.
export default function SlideAssociados({ onAbrirLogin }) {
  return (
    <div className="relative w-full h-full flex items-center" style={{ background: 'linear-gradient(135deg, #B87E00 0%, #FFB800 65%, #FFD166 100%)' }}>
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 max-w-full sm:max-w-[55%]">
        <h2 className="font-black text-xl sm:text-3xl lg:text-4xl tracking-tight leading-tight" style={{ color: PRETO }}>💎 Associados SECI</h2>
        <p className="text-sm sm:text-base font-semibold mt-2" style={{ color: '#3B2900' }}>Preços exclusivos em todos os parceiros</p>
        <p className="text-xs sm:text-sm mt-1 hidden sm:block" style={{ color: '#5C4300' }}>Sua carteirinha digital sempre no celular.</p>
        <button
          type="button"
          onClick={onAbrirLogin}
          className="inline-block w-fit mt-4 sm:mt-6 text-xs sm:text-sm font-bold px-5 sm:px-6 py-2.5 sm:py-3.5 rounded-xl text-white transition-transform hover:scale-[1.03]"
          style={{ backgroundColor: ROXO }}
        >
          Ver meus benefícios
        </button>
      </div>

      <div className="hidden sm:flex flex-1 items-center justify-center relative">
        {/* mockup de celular — CSS puro */}
        <div className="relative w-[130px] lg:w-[160px] aspect-[9/18.5] rounded-[1.6rem] bg-slate-900 p-1.5 shadow-2xl rotate-3">
          <div className="w-full h-full rounded-[1.2rem] overflow-hidden bg-white flex flex-col">
            <div className="h-4 flex items-center justify-center flex-shrink-0"><div className="w-10 h-1.5 rounded-full bg-slate-800" /></div>
            <div className="flex-1 flex flex-col items-center justify-center px-2.5" style={{ background: 'linear-gradient(160deg, #0B1F3A 0%, #1a1a1f 100%)' }}>
              <IdentificationCard size={26} weight="duotone" color="#FFB800" />
              <p className="text-white font-black text-[9px] mt-1 tracking-wide">SECI</p>
              <div className="w-9 h-9 rounded-full bg-white/15 mt-2" />
              <div className="w-full h-1.5 rounded-full bg-white/15 mt-2" />
              <div className="w-2/3 h-1.5 rounded-full bg-white/15 mt-1" />
              <span className="mt-2 text-[7px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FFB800', color: '#0F0F14' }}>ATIVO</span>
            </div>
          </div>
        </div>

        <span className="absolute top-[15%] left-[12%] lg:left-[18%] text-[11px] lg:text-xs font-black px-2.5 py-1 rounded-full bg-white shadow-md animate-hero-float" style={{ color: ROXO, animationDelay: '0.3s' }}>
          -30% farmácia
        </span>
        <span className="absolute bottom-[18%] right-[10%] lg:right-[14%] text-[11px] lg:text-xs font-black px-2.5 py-1 rounded-full bg-white shadow-md animate-hero-float" style={{ color: ROXO, animationDelay: '1.1s' }}>
          -20% ótica
        </span>
        <Diamond size={20} weight="fill" color="#fff" className="absolute top-[45%] right-[15%] opacity-70 animate-hero-float" style={{ animationDelay: '1.8s' }} />
      </div>
    </div>
  );
}
