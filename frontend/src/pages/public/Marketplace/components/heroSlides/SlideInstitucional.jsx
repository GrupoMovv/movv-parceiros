import { useNavigate } from 'react-router-dom';
import { ArrowRight, Heart, ShoppingBag, Storefront } from '@phosphor-icons/react';
import { DOURADO } from '../../theme';

const FOTO = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=60';

// Slide 1 — institucional principal: metade texto (gradient roxo), metade
// foto com ícones flutuando por cima (CSS puro, sem lib de animação nova).
export default function SlideInstitucional() {
  const navigate = useNavigate();

  return (
    <div className="relative w-full h-full flex" style={{ background: 'linear-gradient(135deg, #2D0A5C 0%, #4C1D95 60%, #6D28D9 100%)' }}>
      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 max-w-full sm:max-w-[52%]">
        <p className="text-white/60 text-[11px] sm:text-xs font-semibold uppercase tracking-wide">IUB MAIS — Marketplace de Itumbiara</p>
        <h2 className="text-white font-black text-2xl sm:text-4xl lg:text-5xl tracking-tight mt-2 leading-[1.05]">
          Descubra o comércio da sua cidade
        </h2>
        <p className="text-white/75 text-xs sm:text-base mt-3 max-w-md hidden sm:block">
          Milhares de produtos e serviços com condições especiais pra você.
        </p>
        <button
          type="button"
          onClick={() => navigate('/marketplace/categoria/todas')}
          className="inline-flex items-center gap-2 w-fit mt-4 sm:mt-6 text-xs sm:text-sm font-bold px-5 sm:px-6 py-2.5 sm:py-3.5 rounded-xl transition-transform hover:scale-[1.03]"
          style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
        >
          Começar a explorar <ArrowRight size={16} weight="bold" />
        </button>
        <span className="inline-flex items-center gap-1.5 w-fit mt-3 sm:mt-4 text-[10px] sm:text-xs font-semibold text-white/80 bg-white/10 px-3 py-1.5 rounded-full">
          🎁 Cadastro Gratuito
        </span>
      </div>

      <div className="hidden sm:block absolute inset-y-0 right-0 w-[55%] lg:w-[52%]">
        <img
          src={FOTO} alt="" loading="eager"
          className="w-full h-full object-cover"
          style={{ maskImage: 'linear-gradient(90deg, transparent 0%, black 18%)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 18%)' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />

        <ShoppingBag size={30} weight="fill" color={DOURADO} className="absolute top-[18%] left-[15%] animate-hero-float" style={{ animationDelay: '0s' }} />
        <Heart size={24} weight="fill" color="#fff" className="absolute top-[55%] left-[8%] animate-hero-float opacity-80" style={{ animationDelay: '0.8s' }} />
        <Storefront size={28} weight="fill" color={DOURADO} className="absolute bottom-[15%] right-[20%] animate-hero-float" style={{ animationDelay: '1.4s' }} />
      </div>

      <style>{`
        @keyframes hero-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-hero-float { animation: hero-float 3.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
