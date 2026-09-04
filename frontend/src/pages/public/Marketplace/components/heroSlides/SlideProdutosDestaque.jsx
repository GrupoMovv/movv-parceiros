import { useNavigate } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import { Diamond } from '@phosphor-icons/react';
import { DOURADO, ROXO } from '../../theme';

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Slide 2 — produtos reais (exclusivos pra associados) num mini carrossel
// clicável dentro do próprio slide do banner. Dados já vêm prontos por
// prop (buscados uma vez só lá no HeroBannerCarousel, pra não competir com
// o timer de autoplay do slide em si).
export default function SlideProdutosDestaque({ produtos }) {
  const navigate = useNavigate();

  return (
    <div className="relative w-full h-full flex" style={{ background: 'linear-gradient(135deg, #3B0A78 0%, #4C1D95 100%)' }}>
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-14 max-w-full sm:max-w-[38%]">
        <h2 className="text-white font-black text-xl sm:text-3xl lg:text-4xl tracking-tight leading-tight">🔥 Ofertas Imperdíveis</h2>
        <p className="text-white/75 text-xs sm:text-sm mt-2 hidden sm:block">Produtos com preço especial pra associados SECI.</p>
        <button
          type="button"
          onClick={() => navigate('/marketplace#exclusivos')}
          className="inline-block w-fit mt-4 sm:mt-5 text-xs sm:text-sm font-bold px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl"
          style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
        >
          Ver todas as ofertas
        </button>
      </div>

      <div className="hidden sm:flex flex-1 items-center gap-3 pr-6 lg:pr-10 overflow-hidden">
        {produtos.slice(0, 4).map(p => {
          const foto = p.fotos?.[0]?.url;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/marketplace/produto/${p.id}`)}
              className="flex-1 min-w-0 max-w-[150px] bg-white rounded-xl p-2.5 text-left shadow-lg hover:-translate-y-1 transition-transform duration-200"
            >
              <div className="w-full h-[80px] lg:h-[100px] rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">
                {foto ? (
                  <img src={foto} alt={p.nome} loading="lazy" className="w-full h-full object-contain" />
                ) : (
                  <ImageOff className="w-6 h-6 text-slate-200" />
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-700 line-clamp-2 mt-1.5 leading-tight min-h-[2em]">{p.nome}</p>
              {p.preco_associado ? (
                <>
                  <p className="text-slate-400 text-[10px] line-through">{formatarPreco(p.preco)}</p>
                  <p className="text-sm font-bold" style={{ color: ROXO }}>{formatarPreco(p.preco_associado)}</p>
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold" style={{ color: '#B87E00' }}>
                    <Diamond size={8} weight="fill" /> assoc
                  </span>
                </>
              ) : (
                <p className="text-sm font-bold text-slate-800">{formatarPreco(p.preco)}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
