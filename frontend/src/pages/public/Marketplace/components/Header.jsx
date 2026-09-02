import { Link } from 'react-router-dom';
import { Heart, User } from 'lucide-react';
import { ROXO, PRETO } from '../theme';

export default function Header({ nomeAssociado, carregandoAssociado, favoritosAtivos, onToggleFavoritos, qtdFavoritos }) {
  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-5xl mx-auto px-8 lg:px-16 h-16 flex items-center justify-between gap-4">
        <Link to="/marketplace" className="flex items-center gap-2 min-w-0">
          <img src="/iub-logo-sm.png" alt="IUB" className="h-8 w-auto rounded-lg flex-shrink-0" />
          <span className="font-bold text-sm tracking-tight truncate" style={{ color: PRETO }}>
            IUB Marketplace
          </span>
        </Link>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!carregandoAssociado && nomeAssociado && (
            <span className="hidden sm:inline text-sm text-slate-500 mr-1">Olá, {nomeAssociado.split(' ')[0]}</span>
          )}

          <button
            type="button"
            onClick={onToggleFavoritos}
            aria-pressed={favoritosAtivos}
            aria-label="Meus favoritos"
            className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors ${favoritosAtivos ? 'bg-slate-900' : 'hover:bg-slate-100'}`}
          >
            <Heart className="w-4 h-4" style={{ color: favoritosAtivos ? 'white' : '#64748B' }} fill={favoritosAtivos ? 'white' : 'none'} />
            {qtdFavoritos > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                style={{ backgroundColor: ROXO }}
              >
                {qtdFavoritos}
              </span>
            )}
          </button>

          {nomeAssociado ? (
            <Link
              to="/meu-painel"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
              aria-label="Área do associado"
            >
              <User className="w-4 h-4 text-slate-500" />
            </Link>
          ) : (
            <Link
              to="/cadastrar"
              className="text-xs sm:text-sm font-semibold px-3.5 sm:px-4 py-2 rounded-xl text-white transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: ROXO }}
            >
              Ser associado
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
