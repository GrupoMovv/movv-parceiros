import { useNavigate } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { MASCOTE_URL } from '../../../../../components/MascoteIubMais';

// Cards "3D" flutuantes dos serviços em destaque — rotação leve (`tilt`)
// + sombra funda simula profundidade sem precisar de asset novo nenhum.
// `tilt` vai como CSS custom property (--tilt) porque a animação de
// flutuar já mexe em `transform` (translateY) — se a rotação fosse uma
// classe Tailwind normal (-rotate-6 etc.) a animação sobrescreveria ela
// a cada frame. Com --tilt, o próprio keyframe aplica rotate+translateY
// juntos, então a inclinação nunca se perde.
const SERVICOS_DESTAQUE = [
  { emoji: '🧠', label: 'Psicologia', tilt: '-6deg', atraso: '0s' },
  { emoji: '🏋️', label: 'Fitness', tilt: '3deg', atraso: '0.5s' },
  { emoji: '💅', label: 'Estética', tilt: '-3deg', atraso: '1s' },
  { emoji: '🥗', label: 'Nutrição', tilt: '6deg', atraso: '1.5s' },
];

// Slide de divulgação do /marketplace/servicos (lançado nesta mesma
// rodada) — sempre aparece no carrossel, não depende de dado nenhum do
// backend (ao contrário dos slides de categoria/cupons).
export default function SlideServicos() {
  const navigate = useNavigate();

  return (
    <div
      className="relative w-full h-full flex items-center overflow-hidden"
      style={{ background: 'linear-gradient(120deg, #2D0A5C 0%, #4C1D95 50%, #B87E00 135%)' }}
    >
      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 max-w-full sm:max-w-[54%]">
        <p className="text-[#FFB800] font-bold uppercase tracking-[3px] text-[11px] sm:text-xs mb-2">Profissionais de Itumbiara</p>
        <h1 className="font-display font-black text-[#FFB800] leading-[1.02] text-[26px] sm:text-4xl lg:text-5xl" style={{ textShadow: '0 3px 14px rgba(0,0,0,0.35)' }}>
          SEUS SERVIÇOS SÃO VALORIZADOS AQUI
        </h1>
        <p className="font-display font-medium text-white/90 mt-3 text-sm sm:text-lg lg:text-xl">
          Encontre os melhores profissionais de Itumbiara
        </p>

        <button
          type="button"
          onClick={() => navigate('/marketplace/servicos')}
          className="inline-flex items-center gap-2 w-fit mt-5 sm:mt-7 font-display font-bold text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4 rounded-2xl shadow-xl hover:scale-[1.03] transition-transform"
          style={{ backgroundColor: '#FFB800', color: '#0F0F14', boxShadow: '0 10px 28px rgba(0,0,0,0.35)' }}
        >
          🎯 EXPLORAR SERVIÇOS <ArrowRight size={18} weight="bold" />
        </button>
      </div>

      <div className="hidden sm:flex flex-1 items-end justify-center h-full relative">
        <img
          src={MASCOTE_URL}
          alt=""
          className="h-[88%] object-contain animate-servicos-float relative z-10"
          style={{ filter: 'contrast(1.2) saturate(1.25) drop-shadow(0 18px 26px rgba(0,0,0,0.4))' }}
        />

        <div className="absolute inset-0 pointer-events-none">
          {SERVICOS_DESTAQUE.map((s, i) => (
            <div
              key={s.label}
              className="card-servico absolute bg-white rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col items-center gap-0.5 pointer-events-auto"
              style={{
                top: `${[12, 8, 62, 58][i]}%`,
                left: `${[4, 62, 2, 66][i]}%`,
                animationDelay: s.atraso,
                '--tilt': s.tilt,
                boxShadow: '0 14px 24px rgba(0,0,0,0.28)',
              }}
            >
              <span className="text-xl sm:text-2xl leading-none">{s.emoji}</span>
              <span className="text-[9px] sm:text-[11px] font-black text-slate-700 whitespace-nowrap">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes servicos-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        .animate-servicos-float { animation: servicos-float 3.6s ease-in-out infinite; }

        @keyframes servicos-float-tilt {
          0%, 100% { transform: rotate(var(--tilt, 0deg)) translateY(0); }
          50% { transform: rotate(var(--tilt, 0deg)) translateY(-12px); }
        }
        .card-servico {
          animation: servicos-float-tilt 3.6s ease-in-out infinite;
          transition: transform 0.25s ease-out;
        }
        .card-servico:hover {
          animation-play-state: paused;
          transform: rotate(var(--tilt, 0deg)) translateY(-14px) scale(1.08);
        }
      `}</style>
    </div>
  );
}
