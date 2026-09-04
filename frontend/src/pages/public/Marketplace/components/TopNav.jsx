import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Heart, LogOut, Search, MapPin, List, X } from 'lucide-react';
import { ROXO, ROXO_ESCURO, DOURADO } from '../theme';
import ModalEntrar from './ModalEntrar';

const MENU_SECUNDARIO = [
  { label: 'Categorias', href: '#categorias' },
  { label: 'Ofertas', href: '#ofertas' },
  { label: 'Novidades', href: '#novidades' },
  { label: 'Lojas', href: '#lojas' },
];

function scrollPara(e, href) {
  e.preventDefault();
  document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Header estilo marketplace grande (fundo roxo escuro) — logo + busca
// central + localização + perfil na linha principal, com um menu
// secundário claro logo abaixo (categorias/ofertas/lojas/SECI/vender).
export default function TopNav({
  nomeAssociado, carregandoAssociado, favoritosAtivos, onToggleFavoritos, qtdFavoritos,
  onSair, onLoginSuccess, searchQuery, onSearchChange, onSearchSubmit,
}) {
  const [modalEntrarAberto, setModalEntrarAberto] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  function irParaInicio(e) {
    e.preventDefault();
    if (location.pathname === '/marketplace') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/marketplace');
    }
  }

  return (
    <header className="sticky top-0 z-40 shadow-md">
      <div className="h-[68px] flex items-center gap-3 sm:gap-5 max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full" style={{ backgroundColor: ROXO }}>
        <Link to="/marketplace" onClick={irParaInicio} className="flex items-center gap-2 flex-shrink-0">
          <img src="/iub-logo-sm.png" alt="IUB" className="h-10 w-auto rounded-lg" />
          <span className="hidden lg:inline font-black text-sm tracking-tight text-white">IUB MAIS</span>
        </Link>

        <form
          onSubmit={(e) => { e.preventDefault(); onSearchSubmit?.(); }}
          className="flex-1 min-w-0 sm:max-w-2xl flex items-center h-11 rounded-lg bg-white overflow-hidden"
        >
          <Search className="w-4 h-4 text-slate-400 ml-3.5 flex-shrink-0" />
          <input
            id="busca-marketplace"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Buscar produtos, serviços ou lojas em Itumbiara..."
            className="flex-1 min-w-0 bg-transparent px-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            className="hidden sm:flex items-center gap-1.5 h-full px-4 text-xs font-bold uppercase tracking-wide flex-shrink-0"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            Buscar
          </button>
        </form>

        <span className="hidden md:flex items-center gap-1 text-xs text-white/80 flex-shrink-0 whitespace-nowrap">
          <MapPin className="w-3.5 h-3.5" style={{ color: DOURADO }} /> Itumbiara, GO
        </span>

        <button
          type="button"
          onClick={onToggleFavoritos}
          aria-pressed={favoritosAtivos}
          aria-label="Meus favoritos"
          className={`hidden sm:flex relative w-9 h-9 rounded-full flex-shrink-0 items-center justify-center transition-colors duration-200 ${favoritosAtivos ? 'bg-white/20' : 'hover:bg-white/10'}`}
        >
          <Heart className="w-4 h-4" style={{ color: favoritosAtivos ? DOURADO : '#fff' }} fill={favoritosAtivos ? DOURADO : 'none'} />
          {qtdFavoritos > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>
              {qtdFavoritos}
            </span>
          )}
        </button>

        {carregandoAssociado ? (
          <div className="h-4 w-16 rounded-full bg-white/15 animate-pulse flex-shrink-0" />
        ) : nomeAssociado ? (
          <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
            <Link to="/meu-painel" className="text-sm font-medium text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap">
              💎 {nomeAssociado.split(' ')[0]}
            </Link>
            <button type="button" onClick={onSair} aria-label="Sair" title="Sair" className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setModalEntrarAberto(true)}
            className="hidden sm:inline-flex text-sm font-semibold px-4 py-2 rounded-lg flex-shrink-0 whitespace-nowrap"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            Entrar
          </button>
        )}

        <button
          type="button"
          onClick={() => setMenuMobileAberto(v => !v)}
          aria-label="Menu"
          className="sm:hidden w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white hover:bg-white/10 transition-colors"
        >
          {menuMobileAberto ? <X className="w-5 h-5" /> : <List className="w-5 h-5" />}
        </button>
      </div>

      {/* menu secundário — claro, colado embaixo do roxo */}
      <div className="hidden sm:block bg-white border-b border-slate-100">
        <nav className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 flex items-center gap-1 h-10">
          {MENU_SECUNDARIO.map(item => (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => scrollPara(e, item.href)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
            >
              {item.label}
            </a>
          ))}
          <Link to="/cadastrar-associado" className="text-xs font-bold px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition-colors" style={{ color: ROXO_ESCURO }}>
            Sou SECI 💎
          </Link>
          <Link to="/vender" className="text-xs font-semibold px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition-colors text-slate-600 hover:text-slate-900 ml-auto">
            Vender no IUB MAIS
          </Link>
        </nav>
      </div>

      {/* menu mobile expandido */}
      {menuMobileAberto && (
        <div className="sm:hidden bg-white border-b border-slate-100 px-4 py-3 space-y-2.5">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5" style={{ color: ROXO }} /> Itumbiara, GO
          </div>
          {MENU_SECUNDARIO.map(item => (
            <a key={item.label} href={item.href} onClick={(e) => { scrollPara(e, item.href); setMenuMobileAberto(false); }} className="block text-sm font-medium text-slate-600 py-1">
              {item.label}
            </a>
          ))}
          <Link to="/cadastrar-associado" onClick={() => setMenuMobileAberto(false)} className="block text-sm font-bold py-1" style={{ color: ROXO }}>Sou SECI 💎</Link>
          <Link to="/vender" onClick={() => setMenuMobileAberto(false)} className="block text-sm font-medium text-slate-600 py-1">Vender no IUB MAIS</Link>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { onToggleFavoritos(); setMenuMobileAberto(false); }}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg border ${favoritosAtivos ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}
            >
              <Heart className="w-3.5 h-3.5" fill={favoritosAtivos ? '#fff' : 'none'} /> Favoritos {qtdFavoritos > 0 && `(${qtdFavoritos})`}
            </button>
            {nomeAssociado ? (
              <button type="button" onClick={() => { onSair(); setMenuMobileAberto(false); }} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg border border-slate-200 text-slate-600">
                <LogOut className="w-3.5 h-3.5" /> Sair
              </button>
            ) : (
              <button type="button" onClick={() => { setModalEntrarAberto(true); setMenuMobileAberto(false); }} className="flex-1 text-xs font-semibold py-2.5 rounded-lg text-white" style={{ backgroundColor: ROXO }}>
                Entrar
              </button>
            )}
          </div>
        </div>
      )}

      {modalEntrarAberto && (
        <ModalEntrar onClose={() => setModalEntrarAberto(false)} onLoginSuccess={onLoginSuccess} />
      )}
    </header>
  );
}
