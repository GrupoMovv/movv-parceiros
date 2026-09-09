import { useNavigate } from 'react-router-dom';
import { Fire, ArrowRight, Sparkle, Clock } from '@phosphor-icons/react';
import { DOURADO, DOURADO_ESCURO, ROXO_ESCURO } from '../../theme';

// Mesma foto do slide institucional (comércio local) — blur + overlay
// roxo/dourado por cima, pra não competir com o texto.
const FOTO = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=60';

function formatarDataDestaque(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit' });
  const mes = d.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
  return `${dia} DE ${mes}`;
}

// Slide promocional do Fecha Mês — só entra no carrossel (ver
// HeroBannerCarousel) quando faltam <= 15 dias pro evento; no dia em si
// quem assume é o FechaMesBanner (topo da home), não este slide.
export default function SlideFechaMes({ info }) {
  const navigate = useNavigate();

  function verProdutos() {
    navigate('/marketplace');
    setTimeout(() => document.querySelector('#fecha-mes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, #7C2D12 55%, ${DOURADO_ESCURO} 100%)` }}>
      <img
        src={FOTO} alt="" loading="lazy"
        className="absolute inset-0 w-full h-full object-cover opacity-20 scale-110"
        style={{ filter: 'blur(3px)' }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO}E6 0%, rgba(124,45,18,0.85) 55%, ${DOURADO_ESCURO}CC 100%)` }} />

      {/* partículas/chamas decorativas */}
      <Fire size={140} weight="fill" className="hidden sm:block absolute -bottom-8 -left-8 opacity-[0.08] rotate-12" color="#fff" />
      <Sparkle size={28} weight="fill" color={DOURADO} className="absolute top-8 right-10 opacity-70 animate-fecha-mes-float" style={{ animationDelay: '0.3s' }} />
      <Sparkle size={16} weight="fill" color={DOURADO} className="hidden sm:block absolute bottom-16 left-16 opacity-60 animate-fecha-mes-float" style={{ animationDelay: '1s' }} />
      <Fire size={22} weight="fill" color={DOURADO} className="absolute top-16 left-12 opacity-50 animate-fecha-mes-float" style={{ animationDelay: '0.6s' }} />

      <div className="relative z-10 max-w-2xl mx-auto px-6 sm:px-10 text-center">
        <span className="text-4xl sm:text-6xl">🔥</span>
        <h2 className="text-white font-black uppercase tracking-tight leading-[1.05] text-xl sm:text-4xl lg:text-5xl mt-2">
          Fecha Mês está chegando!
        </h2>
        <p className="text-white/85 text-xs sm:text-lg mt-2 sm:mt-3 font-medium">
          A super promoção de 24h do IUB MAIS
        </p>

        <p className="font-black mt-3 sm:mt-5 text-lg sm:text-3xl" style={{ color: DOURADO }}>
          {formatarDataDestaque(info.data_evento)}
        </p>
        <span className="inline-flex items-center gap-1.5 mt-1.5 sm:mt-2 text-[11px] sm:text-sm font-bold text-white/90 bg-white/10 px-3 py-1 rounded-full">
          <Clock size={13} weight="bold" /> Faltam {info.dias_restantes} {info.dias_restantes === 1 ? 'dia' : 'dias'}
        </span>

        <p className="hidden sm:block text-white/80 text-sm mt-4 max-w-md mx-auto">
          Descontos <strong className="text-white">ATÉ 50%</strong> em centenas de produtos dos nossos parceiros.
        </p>

        <div className="flex items-center justify-center gap-2 sm:gap-3 mt-4 sm:mt-6 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded-full border"
            style={{ color: DOURADO, borderColor: 'rgba(255,184,0,0.4)', backgroundColor: 'rgba(255,184,0,0.08)' }}
          >
            <Fire size={12} weight="fill" /> Apenas 24 horas
          </span>
          <button
            type="button"
            onClick={verProdutos}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl shadow-lg hover:brightness-105 transition"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            Ver produtos <ArrowRight size={14} weight="bold" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fecha-mes-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-fecha-mes-float { animation: fecha-mes-float 3.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
