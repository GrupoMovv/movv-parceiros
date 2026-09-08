import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import { Diamond, ArrowRight } from '@phosphor-icons/react';
import { DOURADO, DOURADO_ESCURO, ROXO } from '../../theme';

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Slide 2 — produtos reais (exclusivos pra associados) num mini carrossel
// clicável dentro do próprio slide do banner. Dados já vêm prontos por
// prop (buscados uma vez só lá no HeroBannerCarousel, pra não competir com
// o timer de autoplay do slide em si) — já filtrados/ordenados por maior
// desconto e só com foto de verdade (ver getExclusivosAssociados no back).
export default function SlideProdutosDestaque({ produtos }) {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const direcaoRef = useRef(1);

  // Auto-scroll "vai e volta" (ping-pong) pelos cards — dá a sensação de
  // ofertas passando sem nunca dar aquele salto brusco de volta ao início.
  useEffect(() => {
    if (produtos.length <= 1) return;
    const id = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const card = el.children[0];
      if (!card) return;
      const passo = card.getBoundingClientRect().width + 16;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;
      let proximo = el.scrollLeft + direcaoRef.current * passo;
      if (proximo >= maxScroll) { proximo = maxScroll; direcaoRef.current = -1; }
      else if (proximo <= 0) { proximo = 0; direcaoRef.current = 1; }
      el.scrollTo({ left: proximo, behavior: 'smooth' });
    }, 3200);
    return () => clearInterval(id);
  }, [produtos]);

  const maiorDesconto = produtos.reduce((max, p) => Math.max(max, p.desconto_pct || 0), 0);

  return (
    <div className="relative w-full h-full flex items-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #3B0A78 0%, #4C1D95 100%)' }}>
      <div className="flex-shrink-0 w-[44%] sm:w-[40%] flex flex-col justify-center px-4 sm:px-8 lg:px-14 z-10">
        <p className="text-white font-black uppercase tracking-tight leading-[1.05] text-base sm:text-3xl lg:text-5xl">
          🔥 Ofertas<br className="hidden sm:block" /> Imperdíveis
        </p>
        {maiorDesconto > 0 && (
          <p className="font-black mt-1.5 sm:mt-3 text-[11px] sm:text-lg lg:text-xl" style={{ color: DOURADO }}>
            Até {maiorDesconto}% OFF pra associados SECI
          </p>
        )}
        <p className="hidden lg:block text-white/70 text-sm mt-2 max-w-xs">
          Descontos exclusivos que você só encontra aqui.
        </p>
        <span
          className="hidden sm:inline-flex items-center gap-1.5 w-fit mt-3 sm:mt-4 text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border"
          style={{ color: DOURADO, borderColor: 'rgba(255,184,0,0.4)', backgroundColor: 'rgba(255,184,0,0.08)' }}
        >
          <Diamond size={11} weight="fill" /> Preço associado ativo
        </span>
        <button
          type="button"
          onClick={() => navigate('/marketplace#exclusivos')}
          className="inline-block w-fit mt-3 sm:mt-5 text-[11px] sm:text-sm font-black px-3.5 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl shadow-lg hover:brightness-105 transition"
          style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
        >
          Ver todas as ofertas →
        </button>
      </div>

      <div className="flex-1 min-w-0 flex items-center h-full py-4 sm:py-6 pr-3 sm:pr-8 lg:pr-12">
        <div
          ref={scrollRef}
          className="hero-produtos-scroll flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory w-full"
        >
          {produtos.map(p => {
            const foto = p.fotos?.[0]?.url;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/marketplace/produto/${p.id}`)}
                className="snap-start flex-shrink-0 w-[112px] sm:w-[168px] lg:w-[236px] bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-2xl hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 text-left overflow-hidden"
              >
                <div className="relative w-full h-[78px] sm:h-[118px] lg:h-[160px] bg-white flex items-center justify-center p-2 sm:p-3">
                  {foto ? (
                    <img src={foto} alt={p.nome} loading="lazy" className="w-full h-full object-contain" />
                  ) : (
                    <ImageOff className="w-6 h-6 text-slate-200" />
                  )}
                  {p.desconto_pct > 0 && (
                    <span
                      className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 text-[9px] sm:text-xs font-black px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow"
                      style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
                    >
                      -{p.desconto_pct}% OFF
                    </span>
                  )}
                </div>

                <div className="px-2 sm:px-3 pt-1.5 sm:pt-2 pb-2 sm:pb-3">
                  <p className="text-[10px] sm:text-sm lg:text-base font-bold text-slate-800 line-clamp-2 leading-tight min-h-[2.2em]">
                    {p.nome}
                  </p>
                  <p className="text-slate-400 text-[9px] sm:text-xs line-through mt-1">{formatarPreco(p.preco)}</p>
                  <p className="font-black leading-tight text-sm sm:text-lg lg:text-xl" style={{ color: DOURADO_ESCURO }}>
                    {formatarPreco(p.preco_associado)}
                  </p>
                </div>

                <div className="flex items-center justify-between px-2 sm:px-3 py-1 sm:py-1.5" style={{ backgroundColor: ROXO }}>
                  <span className="inline-flex items-center gap-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-wide text-white">
                    <Diamond size={9} weight="fill" style={{ color: DOURADO }} /> Exclusivo
                  </span>
                  <span className="hidden lg:inline-flex items-center gap-0.5 text-[10px] font-bold text-white/85">
                    Ver detalhes <ArrowRight size={11} weight="bold" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <style>{`.hero-produtos-scroll{scrollbar-width:none;-ms-overflow-style:none}.hero-produtos-scroll::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
}
