import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Heart, LogOut, Search, MapPin, CreditCard, Users2, ChevronDown, User } from 'lucide-react';
import { ShoppingCart } from '@phosphor-icons/react';
import { ROXO, ROXO_ESCURO, DOURADO } from '../theme';
import ModalEntrar from './ModalEntrar';
import MenuHorizontalMobile from './MenuHorizontalMobile';
import { useCarrinho } from '../CarrinhoContext';
import AvatarPlaceholder from '../../../../components/AvatarPlaceholder';
import InstallAppButton from '../../../../components/InstallAppButton';
import { getPainelToken } from '../../../../services/apiPainel';
import { useFavoritos, CHAVE_FAVORITOS_PRODUTOS } from '../useFavoritos';

// Itens com `rota` navegam de verdade (react-router); com `href` são
// âncora pra rolar até a seção na própria home (scrollPara). Emoji em vez
// de ícone lucide/phosphor de propósito: "Serviços 🎯"/"Curiosidades
// 💡"/"Sou SECI 💎" já usavam emoji antes dessa reorganização — manter o
// mesmo estilo em todo o menu em vez de misturar com componente de ícone.
// "Produtos" reusa a âncora que already existia como "Categorias" (rola
// até a faixa de categorias da home, ver id="categorias" em
// Marketplace.jsx) — não existe uma página /marketplace/produtos própria
// ainda (ver TODO.md), então é só o rótulo/ícone que mudou.
const MENU_SECUNDARIO = [
  { label: '📦 Produtos', href: '#categorias' },
  { label: '🎯 Serviços', rota: '/marketplace/servicos' },
  { label: '🍔 IUB Food', rota: '/marketplace/food' },
  { label: '🍻 IUB Beer', rota: '/beer' },
  { label: '💡 Curiosidades', rota: '/curiosidades' },
  { label: '🔥 Ofertas', href: '#ofertas' },
  { label: '✨ Novidades', href: '#novidades' },
  { label: '🏪 Lojas', href: '#lojas' },
];

// Header estilo marketplace grande (fundo roxo escuro) — logo + busca
// central + localização + perfil na linha principal, com um menu
// secundário claro logo abaixo (categorias/ofertas/lojas/SECI/vender).
export default function TopNav({
  nomeAssociado, nomeCompleto, fotoUrl, carteirinhaHash, carregandoAssociado,
  onSair, onLoginSuccess, searchQuery, onSearchChange, onSearchSubmit,
}) {
  const [modalEntrarAberto, setModalEntrarAberto] = useState(false);
  const [menuPerfilAberto, setMenuPerfilAberto] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { totalItens: itensCarrinho, pulsar: carrinhoPulsando } = useCarrinho();
  // Contagem/estado de favoritos calculados aqui dentro (não via prop) —
  // toda página que renderiza TopNav precisava lembrar de somar
  // parceiros+produtos favoritos "na mão", e a maioria esquecia (só
  // contava parceiros), deixando o badge errado em quase toda página
  // menos a home. Única fonte de verdade agora.
  const { favoritos: favoritosParceiros } = useFavoritos();
  const { favoritos: favoritosProdutos } = useFavoritos(CHAVE_FAVORITOS_PRODUTOS);
  const qtdFavoritos = favoritosParceiros.length + favoritosProdutos.length;
  const naFavoritos = location.pathname === '/favoritos';
  const menuPerfilRef = useRef(null);

  useEffect(() => {
    if (!menuPerfilAberto) return;
    function aoClicarFora(e) {
      if (menuPerfilRef.current && !menuPerfilRef.current.contains(e.target)) setMenuPerfilAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [menuPerfilAberto]);

  function irParaInicio(e) {
    e.preventDefault();
    if (location.pathname === '/marketplace') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/marketplace');
    }
  }

  // Âncoras do menu (Produtos/Ofertas/Novidades/Lojas) só existem na home
  // — clicar nelas de outra rota (ex.: /marketplace/food) não fazia nada,
  // porque document.querySelector(href) não acha o elemento fora da home.
  // Se já está na home, rola direto; se não, navega pra home E manda o id
  // alvo via router state — Marketplace.jsx lê isso e rola depois de
  // montar (ver useEffect lá).
  function irParaAncora(e, href) {
    e.preventDefault();
    const id = href.slice(1);
    if (location.pathname === '/marketplace') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate('/marketplace', { state: { scrollTo: id } });
    }
  }

  // Menu horizontal mobile (ver MenuHorizontalMobile.jsx) reusa o mesmo
  // MENU_SECUNDARIO do desktop pra não duplicar a lista em dois lugares,
  // só acrescenta Jogar/SECI na ponta — no desktop esses dois já têm
  // lugar próprio fora do MENU_SECUNDARIO (pill JOGAR e link "Sou SECI"),
  // no mobile compacto os dois entram como mais uma pill rolável em vez
  // de precisar de espaço fixo dedicado.
  const itensMenuMobile = [
    { label: '🎡 Jogar', rota: getPainelToken() ? '/jogar' : '/jogar/login' },
    ...MENU_SECUNDARIO,
    { label: '💎 SECI', rota: '/cadastrar-associado' },
  ];

  return (
    <header className="sticky top-0 z-40 shadow-md w-full" style={{ backgroundColor: ROXO }}>
      <div className="h-[68px] flex items-center gap-3 sm:gap-5 max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full">
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

        <Link
          to="/favoritos"
          aria-current={naFavoritos ? 'page' : undefined}
          aria-label="Meus favoritos"
          className={`flex relative w-9 h-9 rounded-full flex-shrink-0 items-center justify-center transition-colors duration-200 ${naFavoritos ? 'bg-white/20' : 'hover:bg-white/10'}`}
        >
          <Heart className="w-4 h-4" style={{ color: naFavoritos ? DOURADO : '#fff' }} fill={naFavoritos ? DOURADO : 'none'} />
          {qtdFavoritos > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>
              {qtdFavoritos}
            </span>
          )}
        </Link>

        <Link
          to="/marketplace/carrinho"
          aria-label="Meu carrinho"
          className={`hidden sm:flex relative w-9 h-9 rounded-full flex-shrink-0 items-center justify-center hover:bg-white/10 transition-colors duration-200 ${carrinhoPulsando ? 'animate-carrinho-pulso' : ''}`}
        >
          <ShoppingCart size={18} weight="duotone" color="#fff" />
          {itensCarrinho > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>
              {itensCarrinho}
            </span>
          )}
        </Link>

        {/* Só desktop — no mobile o atalho de Jogar mora na primeira pill
            do menu horizontal rolável (ver itensMenuMobile), pra não
            disputar espaço fixo na barra compacta. */}
        <Link
          to={getPainelToken() ? '/jogar' : '/jogar/login'}
          aria-label="Joguinhos IUB MAIS+"
          className="hidden sm:flex items-center gap-1.5 flex-shrink-0 text-xs sm:text-sm font-black px-2.5 sm:px-3.5 py-2 rounded-full text-black whitespace-nowrap animate-jogar-blink"
          style={{ backgroundColor: DOURADO }}
        >
          🎡 <span className="hidden sm:inline">JOGAR</span>
        </Link>

        {/* wrapper externo em vez de passar "hidden" direto no className do
            botão — o próprio componente já aplica "inline-flex" sem prefixo
            nas próprias classes, e ter dois utilitários de display sem
            prefixo (inline-flex + hidden) no mesmo elemento é ambíguo (quem
            "ganha" depende da ordem interna do CSS gerado pelo Tailwind,
            não é garantido) */}
        <div className="hidden sm:inline-flex">
          <InstallAppButton variant="full" tone="light" />
        </div>
        <div className="sm:hidden flex-shrink-0">
          <InstallAppButton variant="compact" tone="light" />
        </div>

        {/* Perfil compacto — só mobile. Logado vai direto pra /meu (hub da
            conta, já tem carteirinha/dados/sair lá dentro — ver
            MeuPainelLayout.jsx); deslogado abre o mesmo ModalEntrar do
            desktop. Sem dropdown aqui, não tem espaço pra isso numa barra
            compacta. */}
        <div className="sm:hidden flex-shrink-0">
          {carregandoAssociado ? (
            <div className="h-8 w-8 rounded-full bg-white/15 animate-pulse" />
          ) : nomeAssociado ? (
            <Link to="/meu" aria-label="Minha conta">
              {fotoUrl ? (
                <img src={fotoUrl} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white" />
              ) : (
                <AvatarPlaceholder nome={nomeCompleto || nomeAssociado} size={32} className="border-2 border-white" />
              )}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setModalEntrarAberto(true)}
              aria-label="Entrar"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <User className="w-4 h-4 text-white" />
            </button>
          )}
        </div>

        {carregandoAssociado ? (
          <div className="hidden sm:block h-4 w-16 rounded-full bg-white/15 animate-pulse flex-shrink-0" />
        ) : nomeAssociado ? (
          <div className="hidden sm:block relative flex-shrink-0" ref={menuPerfilRef}>
            <button
              type="button"
              onClick={() => setMenuPerfilAberto(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-white pl-1 pr-2 py-1 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              {fotoUrl ? (
                <img src={fotoUrl} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white flex-shrink-0" />
              ) : (
                <AvatarPlaceholder nome={nomeCompleto || nomeAssociado} size={32} className="border-2 border-white" />
              )}
              {nomeAssociado.split(' ')[0]}
              <ChevronDown className={`w-3.5 h-3.5 text-white/60 transition-transform ${menuPerfilAberto ? 'rotate-180' : ''}`} />
            </button>

            {menuPerfilAberto && (
              <div className="absolute right-0 top-[calc(100%+6px)] w-60 bg-white rounded-xl shadow-2xl border border-slate-100 py-1.5 overflow-hidden">
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-800 truncate">{nomeCompleto || nomeAssociado}</p>
                  <p className="text-[11px] text-slate-400">Associado SECI</p>
                </div>
                {carteirinhaHash && (
                  <Link
                    to={`/carteirinha/${carteirinhaHash}`}
                    onClick={() => setMenuPerfilAberto(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" style={{ color: ROXO }} /> Ver minha carteirinha
                  </Link>
                )}
                <Link
                  to="/meu"
                  onClick={() => setMenuPerfilAberto(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Users2 className="w-4 h-4" style={{ color: ROXO }} /> Editar dados / dependentes
                </Link>
                <Link
                  to="/favoritos"
                  onClick={() => setMenuPerfilAberto(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Heart className="w-4 h-4" style={{ color: ROXO }} /> Meus favoritos
                  {qtdFavoritos > 0 && <span className="ml-auto text-[11px] font-bold text-slate-400">{qtdFavoritos}</span>}
                </Link>
                <button
                  type="button"
                  onClick={() => { setMenuPerfilAberto(false); onSair(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-slate-100"
                >
                  <LogOut className="w-4 h-4" /> Sair
                </button>
              </div>
            )}
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
      </div>

      {/* menu secundário desktop — claro, colado embaixo do roxo */}
      <div className="hidden sm:block bg-white border-b border-slate-100">
        <nav className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 flex items-center gap-1 h-10">
          {MENU_SECUNDARIO.map(item => item.rota ? (
            <Link
              key={item.label}
              to={item.rota}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => irParaAncora(e, item.href)}
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

      {/* menu horizontal mobile — estilo iFood/Mercado Livre, sempre
          visível (nada escondido atrás de hambúrguer). Substitui o menu
          mobile expandido de antes por completo. */}
      <MenuHorizontalMobile itens={itensMenuMobile} onAncoraClick={irParaAncora} />

      {modalEntrarAberto && (
        <ModalEntrar onClose={() => setModalEntrarAberto(false)} onLoginSuccess={onLoginSuccess} />
      )}

      <style>{`
        @keyframes carrinho-pulso { 0%, 100% { transform: scale(1); } 30% { transform: scale(1.25); } }
        .animate-carrinho-pulso { animation: carrinho-pulso 0.7s ease-in-out; }
        @keyframes jogar-blink {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,184,0,0.7); transform: scale(1); }
          50% { box-shadow: 0 0 0 6px rgba(255,184,0,0); transform: scale(1.06); }
        }
        .animate-jogar-blink { animation: jogar-blink 1.8s ease-in-out infinite; }
      `}</style>
    </header>
  );
}
