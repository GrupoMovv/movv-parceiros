import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { House, MagnifyingGlass, Heart, UserCircle } from '@phosphor-icons/react';
import { ROXO } from '../theme';
import ModalEntrar from './ModalEntrar';

function focarBusca() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => document.getElementById('busca-marketplace')?.focus(), 300);
}

// Menu inferior fixo só no mobile — atalho de uma mão pras 4 ações mais
// usadas, sem precisar rolar até o topo pra achar a navbar.
export default function MobileBottomNav({ favoritosAtivos, onToggleFavoritos, nomeAssociado, onLoginSuccess }) {
  const [modalAberto, setModalAberto] = useState(false);
  const location = useLocation();
  const emCasa = location.pathname === '/marketplace';

  return (
    <>
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex items-stretch h-14 pb-[env(safe-area-inset-bottom)]">
        <Link to="/marketplace" className="flex-1 flex flex-col items-center justify-center gap-0.5">
          <House size={20} weight={emCasa ? 'fill' : 'regular'} color={emCasa ? ROXO : '#94A3B8'} />
          <span className="text-[10px] font-medium" style={{ color: emCasa ? ROXO : '#94A3B8' }}>Início</span>
        </Link>

        <button type="button" onClick={focarBusca} className="flex-1 flex flex-col items-center justify-center gap-0.5">
          <MagnifyingGlass size={20} color="#94A3B8" />
          <span className="text-[10px] font-medium text-slate-400">Buscar</span>
        </button>

        <button type="button" onClick={onToggleFavoritos} className="flex-1 flex flex-col items-center justify-center gap-0.5">
          <Heart size={20} weight={favoritosAtivos ? 'fill' : 'regular'} color={favoritosAtivos ? '#EF4444' : '#94A3B8'} />
          <span className="text-[10px] font-medium" style={{ color: favoritosAtivos ? '#EF4444' : '#94A3B8' }}>Favoritos</span>
        </button>

        {nomeAssociado ? (
          <Link to="/meu-painel" className="flex-1 flex flex-col items-center justify-center gap-0.5">
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
