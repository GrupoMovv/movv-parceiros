import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { House, MagnifyingGlass, Heart, UserCircle, ShoppingCart } from '@phosphor-icons/react';
import { ROXO } from '../theme';
import ModalEntrar from './ModalEntrar';
import { useCarrinho } from '../CarrinhoContext';
import { useFavoritos, CHAVE_FAVORITOS_PRODUTOS } from '../useFavoritos';

function focarBusca() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => document.getElementById('busca-marketplace')?.focus(), 300);
}

// Menu inferior fixo só no mobile — atalho de uma mão pras 4 ações mais
// usadas, sem precisar rolar até o topo pra achar a navbar.
export default function MobileBottomNav({ nomeAssociado, onLoginSuccess }) {
  const [modalAberto, setModalAberto] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const emCasa = location.pathname === '/marketplace';
  const noCarrinho = location.pathname === '/marketplace/carrinho';
  const naFavoritos = location.pathname === '/favoritos';
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

        <button type="button" onClick={focarBusca} className="flex-1 flex flex-col items-center justify-center gap-0.5">
          <MagnifyingGlass size={20} color="#94A3B8" />
          <span className="text-[10px] font-medium text-slate-400">Buscar</span>
        </button>

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
          <button type="button" onClick={() => setModalAberto(true)} className="flex-1 flex flex-col items-center justify-center gap-0.5">
            <UserCircle size={20} color="#94A3B8" />
            <span className="text-[10px] font-medium text-slate-400">Perfil</span>
          </button>
        )}
      </nav>

      {modalAberto && <ModalEntrar onClose={() => setModalAberto(false)} onLoginSuccess={onLoginSuccess} />}
    </>
  );
}
