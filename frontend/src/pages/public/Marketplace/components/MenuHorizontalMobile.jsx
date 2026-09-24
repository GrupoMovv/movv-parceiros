import { Link, useLocation } from 'react-router-dom';
import { ROXO } from '../theme';
import BadgeMenu from './BadgeMenu';

// Menu de categorias em pills horizontais roláveis, só mobile — estilo
// iFood/Mercado Livre. Antes esse menu só existia escondido atrás do
// hambúrguer (2 toques pra ver as opções); feedback real: "no celular
// tem que clicar nos 3 tracinhos... vamos arrumar isso".
//
// `itens` é o mesmo MENU_SECUNDARIO do TopNav (rota ou href) mais o
// atalho de Jogar prependado por quem usa este componente — mantém uma
// lista só como fonte de verdade da ordem/conteúdo do menu.
//
// Fade nas bordas via mask-image CSS (sempre ligado, não depende de
// tracking de scroll em JS — mais simples e já cumpre o pedido de
// "indicar que há mais conteúdo").
//
// "Ativo" só é calculado pra itens de rota (comparação com
// location.pathname) — itens de âncora (#ofertas etc.) não têm uma
// seção "atual" sem scroll-spy, que seria complexidade extra sem pedido
// explícito disso.
export default function MenuHorizontalMobile({ itens, onAncoraClick }) {
  const location = useLocation();

  return (
    <nav
      aria-label="Categorias"
      className="sm:hidden flex items-center gap-2 overflow-x-auto scrollbar-none px-4 py-2.5 bg-white border-b border-slate-100"
      style={{
        maskImage: 'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
      }}
    >
      {itens.map(item => {
        const ativo = Boolean(item.rota) && location.pathname === item.rota;
        const classeBase = `flex-shrink-0 h-11 flex items-center gap-1.5 text-xs font-semibold px-3.5 rounded-full whitespace-nowrap transition-colors duration-200 ${
          ativo ? 'text-white' : 'bg-slate-50 text-slate-600 active:bg-slate-100'
        }`;
        const estiloAtivo = ativo ? { backgroundColor: ROXO } : undefined;

        return item.rota ? (
          <Link key={item.label} to={item.rota} className={classeBase} style={estiloAtivo}>
            {item.label}
            {item.badge && <BadgeMenu texto={item.badge} />}
          </Link>
        ) : (
          <a key={item.label} href={item.href} onClick={(e) => onAncoraClick(e, item.href)} className={classeBase}>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
