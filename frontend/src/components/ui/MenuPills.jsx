import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ROXO } from '../../pages/public/Marketplace/theme';

const FADE = 28;

// Menu de navegação em pills (painel do parceiro). Mesmo visual do
// MenuHorizontalMobile do marketplace (pills 44px, roxo no ativo, fade nas
// bordas), mas com o que faltou lá pra um menu de 12 itens — feedback
// real: "não tem setinha pra ver os outros, custei achar Configurações,
// precisei selecionar tudo e arrastar":
// - fade e seta só do lado que ainda tem conteúdo (tracking de scroll)
// - seta clicável (mouse sem trackpad não consegue arrastar)
// - pill ativa rola sozinha pro meio ao trocar de rota
// - >= lg (1024px) quebra em linhas e mostra tudo, sem scroll
//
// itens: [{ label, to, end?, badge? }]
export default function MenuPills({ itens, ariaLabel = 'Menu' }) {
  const navRef = useRef(null);
  const location = useLocation();
  const [bordas, setBordas] = useState({ esquerda: false, direita: false });

  const medir = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    setBordas({
      esquerda: el.scrollLeft > 2,
      direita: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return undefined;
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', medir); ro?.disconnect(); };
  }, [medir, itens.length]);

  // Centraliza a pill ativa (ex.: entrou direto em /configuracoes pelo
  // link do email — a aba certa aparece destacada sem precisar procurar).
  useEffect(() => {
    const el = navRef.current;
    const ativo = el?.querySelector('[aria-current="page"]');
    if (!el || !ativo || el.scrollWidth <= el.clientWidth) return;
    el.scrollTo({ left: ativo.offsetLeft - el.clientWidth / 2 + ativo.offsetWidth / 2, behavior: 'smooth' });
  }, [location.pathname]);

  function rolar(direcao) {
    const el = navRef.current;
    el?.scrollBy({ left: direcao * el.clientWidth * 0.7, behavior: 'smooth' });
  }

  const mascara = `linear-gradient(to right, ${bordas.esquerda ? 'transparent 0, black ' + FADE + 'px' : 'black 0'}, ${bordas.direita ? `black calc(100% - ${FADE}px), transparent 100%` : 'black 100%'})`;

  return (
    <div className="relative">
      <nav
        ref={navRef}
        aria-label={ariaLabel}
        className="relative flex items-center gap-2 overflow-x-auto scrollbar-none py-2.5 lg:flex-wrap lg:overflow-visible"
        style={{ maskImage: mascara, WebkitMaskImage: mascara }}
      >
        {itens.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-shrink-0 h-11 lg:h-9 flex items-center gap-1.5 text-sm font-semibold px-4 lg:px-3.5 rounded-full whitespace-nowrap transition-colors duration-200 ${
                isActive ? 'text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 active:bg-slate-200'
              }`
            }
            style={({ isActive }) => (isActive ? { backgroundColor: ROXO } : undefined)}
          >
            {item.label}
            {item.badge > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white bg-red-500">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <SetaRolagem lado="esquerda" visivel={bordas.esquerda} onClick={() => rolar(-1)} />
      <SetaRolagem lado="direita" visivel={bordas.direita} onClick={() => rolar(1)} />
    </div>
  );
}

function SetaRolagem({ lado, visivel, onClick }) {
  const Icone = lado === 'esquerda' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      aria-label={lado === 'esquerda' ? 'Ver itens anteriores do menu' : 'Ver mais itens do menu'}
      className={`lg:hidden absolute top-1/2 -translate-y-1/2 ${lado === 'esquerda' ? 'left-0' : 'right-0'} w-9 h-9 rounded-full bg-white shadow-md border border-slate-100 flex items-center justify-center transition-opacity duration-200 ${
        visivel ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{ color: ROXO }}
    >
      <Icone className="w-5 h-5" />
    </button>
  );
}
