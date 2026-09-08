import { useState } from 'react';
import { Diamond, Tag, Heart, ShoppingCart, X } from 'lucide-react';
import { ROXO, DOURADO } from '../theme';

const SLIDES = [
  {
    icon: Diamond,
    titulo: 'Bem-vindo ao IUB MAIS!',
    texto: 'Você entrou com sua carteirinha SECI — seus preços de associado já aparecem em tudo, automaticamente.',
  },
  {
    icon: Tag,
    titulo: 'Categorias e parceiros',
    texto: 'Navegue por categorias no topo ou explore os parceiros pra encontrar o desconto que você precisa.',
  },
  {
    icon: Heart,
    titulo: 'Favoritos',
    texto: 'Toque no coração pra guardar produtos e parceiros que você quer lembrar depois.',
  },
  {
    icon: ShoppingCart,
    titulo: 'Carrinho e aproveita!',
    texto: 'Monte sua lista de interesse no carrinho e chame o parceiro direto pelo WhatsApp quando quiser fechar.',
  },
];

export default function OnboardingTour({ onFechar }) {
  const [slide, setSlide] = useState(0);
  const ultimo = slide === SLIDES.length - 1;
  const Icone = SLIDES[slide].icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,15,20,0.6)' }}>
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden relative">
        <button
          type="button" onClick={onFechar} aria-label="Pular"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-8 pt-10 pb-6 text-center" style={{ background: `linear-gradient(135deg, ${ROXO} 0%, #7C3AED 100%)` }}>
          <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mx-auto">
            <Icone className="w-8 h-8" style={{ color: DOURADO }} />
          </div>
        </div>

        <div className="px-7 py-6 text-center">
          <h2 className="font-bold text-lg text-slate-900">{SLIDES[slide].titulo}</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">{SLIDES[slide].texto}</p>

          <div className="flex items-center justify-center gap-1.5 mt-5">
            {SLIDES.map((_, i) => (
              <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === slide ? 20 : 6, backgroundColor: i === slide ? ROXO : '#E2E8F0' }} />
            ))}
          </div>

          <div className="flex items-center gap-2 mt-6">
            {slide > 0 && (
              <button type="button" onClick={() => setSlide(s => s - 1)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-500 border border-slate-200">
                Voltar
              </button>
            )}
            <button
              type="button"
              onClick={() => (ultimo ? onFechar() : setSlide(s => s + 1))}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: ROXO }}
            >
              {ultimo ? 'Aproveitar!' : 'Próximo'}
            </button>
          </div>
          {!ultimo && (
            <button type="button" onClick={onFechar} className="mt-3 text-xs font-medium text-slate-400 hover:text-slate-600">
              Pular
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
