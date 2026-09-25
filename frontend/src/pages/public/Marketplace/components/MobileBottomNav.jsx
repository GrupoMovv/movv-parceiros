import { Link, useLocation, useNavigate } from 'react-router-dom';
import { House, Heart, UserCircle, ShoppingCart } from '@phosphor-icons/react';
import { ROXO } from '../theme';
import { useCarrinho } from '../CarrinhoContext';
import { useFavoritos, CHAVE_FAVORITOS_PRODUTOS } from '../useFavoritos';
import { getPainelToken } from '../../../../services/apiPainel';

// Menu inferior fixo só no mobile — atalho de uma mão pras 4 ações mais
// usadas, sem precisar rolar até o topo pra achar a navbar.
export default function MobileBottomNav({ nomeAssociado, onLoginSuccess }) {
  const location = useLocation();
  const navigate = useNavigate();
  const emCasa = location.pathname === '/marketplace';
  const noCarrinho = location.pathname === '/marketplace/carrinho';
  const naFavoritos = location.pathname === '/favoritos';
  const naJogar = location.pathname.startsWith('/jogar');
  const { totalItens } = useCarrinho();
  // Mesma lógica do TopNav — favorito calculado aqui, não via prop (ver
  // comentário lá: contagem espalhada por prop em cada página é fácil de
  // esquecer de atualizar).
  const { favoritos: favoritosParceiros } = useFavoritos();
  const { favoritos: favoritosProdutos } = useFavoritos(CHAVE_FAVORITOS_PRODUTOS);
  const qtdFavoritos = favoritosParceiros.length + favoritosProdutos.length;

  // Link puro pra "/marketplace" não faz nada quando já se está lá (mesma
  // rota, React Router não navega de novo) — usuário rolava a página e
  // clicava Início sem efeito nenhum. Intercepta e rola pro topo sempre;
  // se estiver em outra rota, navega e já rola (sem scroll restoration
  // automático de rota no app, ficaria na posição da rota anterior).
  function irParaInicio(e) {
    e.preventDefault();
    if (emCasa) window.scrollTo({ top: 0, behavior: 'smooth' });
    else { navigate('/marketplace'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }

  return (
    <>
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex items-stretch h-14 pb-[env(safe-area-inset-bottom)]">
        <Link to="/marketplace" onClick={irParaInicio} className="flex-1 flex flex-col items-center justify-center gap-0.5">
          <House size={20} weight={emCasa ? 'fill' : 'regular'} color={emCasa ? ROXO : '#94A3B8'} />
          <span className="text-[10px] font-medium" style={{ color: emCasa ? ROXO : '#94A3B8' }}>Início</span>
        </Link>

        {/* Trocado de "Buscar" pra "Jogar" por decisão explícita — busca já
            existe fixa no topo mobile (não sumiu, só não duplica aqui
            embaixo), e Jogar (Roleta + Memória, cupom diário) é o
            diferencial do IUB MAIS+ que merecia mais destaque. */}
        <Link
          to={getPainelToken() ? '/jogar' : '/entrar?voltar=/jogar'}
          className="flex-1 flex flex-col items-center justify-center gap-0.5"
        >
          <span className="text-xl leading-none">🎡</span>
          <span className="text-[10px] font-medium" style={{ color: naJogar ? ROXO : '#94A3B8' }}>Jogar</span>
        </Link>

        <Link to="/favoritos" className="relative flex-1 flex flex-col items-center justify-center gap-0.5">
          <Heart size={20} weight={naFavoritos ? 'fill' : 'regular'} color={naFavoritos ? '#EF4444' : '#94A3B8'} />
          {qtdFavoritos > 0 && (
            <span className="absolute top-1 right-[27%] min-w-[13px] h-[13px] px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: '#EF4444' }}>
              {qtdFavoritos}
            </span>
          )}
          <span className="text-[10px] font-medium" style={{ color: naFavoritos ? '#EF4444' : '#94A3B8' }}>Favoritos</span>
        </Link>

        <Link to="/marketplace/carrinho" className="relative flex-1 flex flex-col items-center justify-center gap-0.5">
          <ShoppingCart size={20} weight={noCarrinho ? 'fill' : 'regular'} color={noCarrinho ? ROXO : '#94A3B8'} />
          {totalItens > 0 && (
            <span className="absolute top-1 right-[27%] min-w-[13px] h-[13px] px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: '#FFB800', color: '#0F0F14' }}>
              {totalItens}
            </span>
          )}
          <span className="text-[10px] font-medium" style={{ color: noCarrinho ? ROXO : '#94A3B8' }}>Carrinho</span>
        </Link>

        {nomeAssociado ? (
          <Link to="/meu" className="flex-1 flex flex-col items-center justify-center gap-0.5">
            <UserCircle size={20} weight="fill" color={ROXO} />
            <span className="text-[10px] font-medium" style={{ color: ROXO }}>Perfil</span>
          </Link>
        ) : (
          <Link to="/acesso" className="flex-1 flex flex-col items-center justify-center gap-0.5">
            <UserCircle size={20} color="#94A3B8" />
            <span className="text-[10px] font-medium text-slate-400">Logar</span>
          </Link>
        )}
      </nav>

    </>
  );
}
