import { useNavigate } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';

function iniciais(nome) {
  return String(nome || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

// Cores rotativas só pro fallback de logo (parceiro sem logo_url ainda) —
// mesma ideia do badge sigla+cor das cartas do Jogo da Memória.
const CORES_BADGE = ['#EF4444', '#0EA5E9', '#22C55E', '#8B5CF6', '#F59E0B', '#DB2777'];

// Base compartilhada dos slides 3/4/5 (Lojas Oficiais por categoria) — não
// é um dos 7 slides em si, cada categoria tem seu próprio arquivo nomeado
// (SlideCategoriaBeleza/Saude/Fitness.jsx) que só passa a config própria
// pra essa base, evitando triplicar o mesmo JSX.
export default function SlideCategoriaOficialBase({ emoji, subtitulo, categoriaSlug, gradiente, lojas }) {
  const navigate = useNavigate();

  return (
    <div className="relative w-full h-full flex items-center justify-center text-center overflow-hidden px-6" style={{ background: gradiente }}>
      <div className="relative z-10 max-w-2xl">
        <p className="text-white font-black text-lg sm:text-2xl lg:text-3xl" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
          {emoji} LOJAS OFICIAIS
        </p>
        <p className="font-black mt-1 text-2xl sm:text-4xl lg:text-5xl text-white" style={{ textShadow: '0 3px 12px rgba(0,0,0,0.3)' }}>
          {subtitulo}
        </p>

        <div className="flex items-center justify-center gap-3 sm:gap-4 mt-5 sm:mt-7 flex-wrap">
          {lojas.map((loja, i) => (
            <button
              key={loja.id}
              type="button"
              onClick={() => navigate(`/marketplace/parceiro/${loja.slug}`)}
              className="bg-white rounded-2xl shadow-xl px-3 sm:px-5 py-3 sm:py-4 flex flex-col items-center gap-2 hover:-translate-y-1 transition-transform w-[92px] sm:w-[128px]"
            >
              {loja.logo_url ? (
                <img src={loja.logo_url} alt={loja.nome} className="w-10 h-10 sm:w-14 sm:h-14 rounded-full object-cover" loading="lazy" />
              ) : (
                <div
                  className="w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white font-black text-sm sm:text-base"
                  style={{ backgroundColor: CORES_BADGE[i % CORES_BADGE.length] }}
                >
                  {iniciais(loja.nome)}
                </div>
              )}
              <p className="text-[10px] sm:text-xs font-bold text-slate-700 line-clamp-2 leading-tight">{loja.nome}</p>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => navigate(`/marketplace/categoria/${categoriaSlug}`)}
          className="inline-flex items-center gap-2 mt-5 sm:mt-7 text-sm sm:text-base font-black px-6 sm:px-8 py-3 sm:py-4 rounded-2xl shadow-xl hover:scale-[1.03] transition-transform bg-white text-slate-900"
        >
          Ver todas <ArrowRight size={18} weight="bold" />
        </button>
      </div>
    </div>
  );
}
