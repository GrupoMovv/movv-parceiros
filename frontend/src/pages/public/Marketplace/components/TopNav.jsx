import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Heart, LogOut } from 'lucide-react';
import { DOURADO } from '../theme';
import ModalEntrar from './ModalEntrar';

const ITENS = [
  { label: 'Ofertas', href: '#ofertas' },
  { label: 'Categorias', href: '#categorias' },
  // aponta pra vitrine compacta "Nossos parceiros" do Bloco 8, não pro
  // #parceiros mais abaixo (grade completa de busca/filtro, seção diferente).
  { label: 'Parceiros', href: '#parceiros-vitrine' },
];

function scrollPara(e, href) {
  e.preventDefault();
  const alvo = document.querySelector(href);
  if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function TopNav({
  nomeAssociado, carregandoAssociado, favoritosAtivos, onToggleFavoritos, qtdFavoritos,
  onSair, onLoginSuccess,
}) {
  const [modalEntrarAberto, setModalEntrarAberto] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // "Início" mirava um scrollIntoView na própria navbar (sticky, sempre "à
  // vista") — o browser não fazia nada porque já considerava ela visível.
  function irParaInicio(e) {
    e.preventDefault();
    if (location.pathname === '/marketplace') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/marketplace');
    }
  }

  return (
    <header
      id="topo"
      className="sticky top-0 z-40 h-[70px] flex items-center backdrop-blur-md"
      style={{ backgroundColor: 'rgba(15,15,20,0.92)', borderBottom: '1px solid #1a1a1f' }}
    >
      <div className="max-w-7xl mx-auto px-8 lg:px-16 w-full flex items-center justify-between gap-4">
        <Link to="/marketplace" className="flex items-center gap-2.5 flex-shrink-0">
          <img src="/iub-logo-sm.png" alt="IUB" className="h-10 w-auto rounded-lg" />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <a
            href="/marketplace"
            onClick={irParaInicio}
            className="hidden sm:inline-block text-sm font-medium text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors duration-300"
          >
            Início
          </a>
          {ITENS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => scrollPara(e, item.href)}
              className="hidden sm:inline-block text-sm font-medium text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors duration-300"
            >
              {item.label}
            </a>
          ))}

          <button
            type="button"
            onClick={onToggleFavoritos}
            aria-pressed={favoritosAtivos}
            aria-label="Meus favoritos"
            className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-300 ${favoritosAtivos ? 'bg-white' : 'hover:bg-white/10'}`}
          >
            <Heart className="w-4 h-4" style={{ color: favoritosAtivos ? '#0F0F14' : 'rgba(255,255,255,0.7)' }} fill={favoritosAtivos ? '#0F0F14' : 'none'} />
            {qtdFavoritos > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
              >
                {qtdFavoritos}
              </span>
            )}
          </button>

          {carregandoAssociado ? (
            <div className="h-4 w-16 rounded-full bg-white/10 animate-pulse ml-1" />
          ) : nomeAssociado ? (
            <div className="flex items-center gap-1">
              <Link
                to="/meu-painel"
                className="text-sm font-medium text-white/90 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors duration-300 whitespace-nowrap"
                title="Minha carteirinha"
              >
                💎 Olá, {nomeAssociado.split(' ')[0]}!
              </Link>
              <button
                type="button"
                onClick={onSair}
                aria-label="Sair"
                title="Sair"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors duration-300"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setModalEntrarAberto(true)}
              className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-300 whitespace-nowrap"
              style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
            >
              Entrar
            </button>
          )}
        </nav>
      </div>

      {modalEntrarAberto && (
        <ModalEntrar onClose={() => setModalEntrarAberto(false)} onLoginSuccess={onLoginSuccess} />
      )}
    </header>
  );
}
