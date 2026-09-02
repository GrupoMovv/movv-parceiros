import { Link } from 'react-router-dom';
import { Search, Heart, User, X } from 'lucide-react';
import { GRADIENT_ROXO, DOURADO } from '../theme';

export default function Header({ nomeAssociado, carregandoAssociado, searchQuery, setSearchQuery, favoritosAtivos, onToggleFavoritos, qtdFavoritos }) {
  return (
    <header className="relative px-4 sm:px-6 pt-6 pb-16 sm:pb-20 overflow-hidden" style={{ background: GRADIENT_ROXO }}>
      {/* textura sutil */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.06, backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 14px)' }}
      />
      {/* glow dourado decorativo */}
      <div
        className="absolute -top-24 -right-24 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: `${DOURADO}33`, filter: 'blur(60px)' }}
      />

      <div className="relative max-w-5xl mx-auto">
        {/* topo: logo + icones */}
        <div className="flex items-center justify-between gap-3">
          <Link to="/marketplace" className="flex items-center gap-2.5">
            <img src="/iub-logo-sm.png" alt="IUB" className="h-11 sm:h-14 w-auto rounded-xl shadow-lg" />
            <span className="text-white font-black text-lg sm:text-2xl tracking-tight leading-none">
              MARKETPLACE
            </span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onToggleFavoritos}
              aria-pressed={favoritosAtivos}
              aria-label="Meus favoritos"
              className="relative w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{ backgroundColor: favoritosAtivos ? DOURADO : 'rgba(255,255,255,0.12)' }}
            >
              <Heart className="w-4.5 h-4.5" style={{ color: favoritosAtivos ? '#3B0A78' : 'white' }} fill={favoritosAtivos ? '#3B0A78' : 'none'} />
              {qtdFavoritos > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center"
                  style={{ backgroundColor: DOURADO, color: '#3B0A78' }}
                >
                  {qtdFavoritos}
                </span>
              )}
            </button>

            <Link
              to={nomeAssociado ? '/meu-painel' : '/cadastrar'}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
              aria-label="Área do associado"
            >
              <User className="w-4.5 h-4.5 text-white" />
            </Link>
          </div>
        </div>

        {/* saudacao ou CTA associado */}
        {carregandoAssociado ? (
          <div className="mt-4 h-6 w-56 max-w-full rounded-full bg-white/15 animate-pulse" />
        ) : nomeAssociado ? (
          <p className="text-white/90 text-sm font-semibold mt-4">Olá, {nomeAssociado}! 👋 <span className="font-normal text-white/70">confira suas ofertas exclusivas</span></p>
        ) : (
          <Link
            to="/cadastrar"
            className="mt-4 flex items-center gap-2 w-fit text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-full transition-transform hover:scale-105"
            style={{ backgroundColor: `${DOURADO}22`, color: DOURADO, border: `1px solid ${DOURADO}55` }}
          >
            🎁 Vire associado e ganhe descontos exclusivos
          </Link>
        )}

        {/* busca */}
        <div className="relative mt-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar produtos, serviços..."
            className="w-full bg-white rounded-2xl pl-11 pr-10 py-3.5 text-sm text-slate-700 placeholder:text-slate-400 shadow-lg outline-none focus:ring-2 transition-shadow"
            style={{ '--tw-ring-color': DOURADO }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center"
              aria-label="Limpar busca"
            >
              <X className="w-3 h-3 text-slate-500" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
