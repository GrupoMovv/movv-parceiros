import { Link } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';
import { ROXO_ESCURO, DOURADO, PRETO } from '../theme';

export default function PartnerCard({ parceiro, favorito, onToggleFavorito }) {
  return (
    <Link
      to={`/marketplace/parceiro/${parceiro.slug}`}
      className="group flex flex-col bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 ease-out hover:-translate-y-1"
    >
      <div
        className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden flex items-center justify-center text-6xl"
        style={{ backgroundColor: `${parceiro.corIcone}1A` }}
      >
        {parceiro.icone}

        <button
          type="button"
          onClick={(e) => { e.preventDefault(); onToggleFavorito(parceiro.slug); }}
          aria-label={favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-pressed={favorito}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center transition-transform hover:scale-110"
        >
          <Heart className="w-4 h-4" style={{ color: favorito ? '#EF4444' : '#94A3B8' }} fill={favorito ? '#EF4444' : 'none'} />
        </button>

        {parceiro.exclusivo && (
          <span
            className="absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={{ backgroundColor: DOURADO, color: ROXO_ESCURO }}
          >
            💎 Exclusivo
          </span>
        )}
      </div>

      <div className="pt-3">
        <h2 className="font-bold text-base leading-tight truncate" style={{ color: PRETO }}>{parceiro.nome}</h2>
        <p className="text-slate-500 text-sm mt-0.5 truncate">{parceiro.categorias[0]}</p>

        <div className="flex items-center gap-1 mt-1.5">
          <Star className="w-3.5 h-3.5" style={{ color: DOURADO }} fill={DOURADO} />
          <span className="text-xs text-slate-500 font-medium">5.0</span>
        </div>
      </div>
    </Link>
  );
}
