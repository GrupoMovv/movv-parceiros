import { useNavigate } from 'react-router-dom';
import { Storefront, Package, WhatsappLogo, ArrowRight } from '@phosphor-icons/react';
import { DOURADO } from '../../theme';

// Slide 3 — chamada institucional pra comerciantes, centrada, com ícones
// flutuantes e um contador dinâmico de parceiros já cadastrados (prova
// social simples, sem inventar número).
export default function SlideComerciantes({ totalParceiros }) {
  const navigate = useNavigate();

  return (
    <div className="relative w-full h-full flex items-center justify-center text-center px-6" style={{ background: 'linear-gradient(135deg, #3B0A78 0%, #4C1D95 55%, #92700C 140%)' }}>
      <Storefront size={80} weight="fill" color="#fff" className="absolute top-[12%] left-[8%] sm:left-[15%] opacity-10 animate-hero-float" style={{ animationDelay: '0s' }} />
      <Package size={64} weight="fill" color={DOURADO} className="absolute bottom-[15%] right-[8%] sm:right-[15%] opacity-20 animate-hero-float" style={{ animationDelay: '1s' }} />
      <WhatsappLogo size={56} weight="fill" color="#25D366" className="absolute top-[20%] right-[10%] sm:right-[20%] opacity-25 animate-hero-float" style={{ animationDelay: '1.8s' }} />

      <div className="relative z-10 max-w-lg">
        <p className="text-white font-black text-lg sm:text-2xl lg:text-3xl">🏢 Anuncie no IUB MAIS</p>
        <p className="mt-1.5 text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight" style={{ color: DOURADO }}>100% GRATUITO</p>
        <p className="text-white/80 text-xs sm:text-sm mt-3">Cadastro em 5 minutos. Milhares de clientes esperando.</p>

        <button
          type="button"
          onClick={() => navigate('/vender')}
          className="inline-flex items-center gap-2 mt-4 sm:mt-6 text-xs sm:text-sm font-bold px-5 sm:px-6 py-2.5 sm:py-3.5 rounded-xl transition-transform hover:scale-[1.03]"
          style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
        >
          Cadastrar minha empresa <ArrowRight size={16} weight="bold" />
        </button>

        {Number(totalParceiros) > 0 && (
          <p className="text-white/60 text-[11px] sm:text-xs mt-3 sm:mt-4">
            Já somos <strong className="text-white">+{totalParceiros}</strong> empresas parceiras
          </p>
        )}
      </div>
    </div>
  );
}
