import { Link } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';
import { ROXO, ROXO_ESCURO, DOURADO, GRAFITE } from '../theme';

export default function PartnerCard({ parceiro, favorito, onToggleFavorito }) {
  return (
    <div className="relative bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); onToggleFavorito(parceiro.slug); }}
        aria-label={favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        aria-pressed={favorito}
        className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center transition-transform hover:scale-110"
      >
        <Heart className="w-4 h-4" style={{ color: favorito ? '#EF4444' : '#94A3B8' }} fill={favorito ? '#EF4444' : 'none'} />
      </button>

      <Link to={`/marketplace/parceiro/${parceiro.slug}`} className="flex flex-col flex-1 p-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-3"
          style={{ backgroundColor: `${parceiro.corIcone}22` }}
        >
          {parceiro.icone}
        </div>

        {parceiro.exclusivo && (
          <span
            className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-full w-fit mb-2 uppercase tracking-wide"
            style={{ backgroundColor: DOURADO, color: ROXO_ESCURO }}
          >
            💎 Exclusivo associado
          </span>
        )}

        <h2 className="font-bold text-sm leading-tight" style={{ color: GRAFITE }}>{parceiro.nome}</h2>

        <div className="flex items-center gap-0.5 mt-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="w-3 h-3" style={{ color: DOURADO }} fill={DOURADO} />
          ))}
          <span className="text-[10px] text-slate-400 ml-1 font-medium">5.0</span>
        </div>

        <p className="text-slate-500 text-xs mt-1.5 leading-snug flex-1 line-clamp-2">{parceiro.descricao}</p>

        <div className="flex flex-wrap gap-1 mt-2.5">
          {parceiro.categorias.slice(0, 2).map((c) => (
            <span key={c} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {c}
            </span>
          ))}
        </div>

        <span
          className="mt-3 text-center text-xs font-bold py-2.5 rounded-xl text-white transition-colors"
          style={{ backgroundColor: ROXO }}
        >
          Ver ofertas →
        </span>
      </Link>
    </div>
  );
}
