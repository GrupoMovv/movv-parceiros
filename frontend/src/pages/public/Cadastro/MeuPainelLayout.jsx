import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, User, Users2, CreditCard, ShoppingBag, LogOut, Menu, X, Loader2 } from 'lucide-react';
import apiPainel, { getPainelToken, setPainelToken } from '../../../services/apiPainel';
import AvatarPlaceholder from '../../../components/AvatarPlaceholder';
import { assetUrl } from '../../../services/api';

const NAVY = '#0B1F3A';
const GOLD = '#D4AF37';

const LINKS = [
  { to: '/meu', end: true, label: 'Painel', icon: Home },
  { to: '/meu/dados', label: 'Meus Dados', icon: User },
  { to: '/meu/dependentes', label: 'Dependentes', icon: Users2 },
  { to: '/meu/carteirinhas', label: 'Carteirinhas', icon: CreditCard },
];

export default function MeuPainelLayout() {
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuAberto, setMenuAberto] = useState(false);

  const recarregar = useCallback(async () => {
    if (!getPainelToken()) { navigate('/cadastrar', { replace: true }); return; }
    try {
      const res = await apiPainel.get('/public/painel/me');
      setDados(res.data);
    } catch {
      setPainelToken(null);
      navigate('/cadastrar', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { recarregar(); }, [recarregar]);

  function handleSair() {
    setPainelToken(null);
    navigate('/cadastrar');
  }

  if (loading || !dados) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: '#F8F7F4' }}>
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: NAVY }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex" style={{ backgroundColor: '#F8F7F4' }}>
      {/* topo mobile */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4" style={{ backgroundColor: NAVY }}>
        <button type="button" onClick={() => setMenuAberto(true)} aria-label="Menu" className="text-white">
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-white font-black text-sm tracking-wide">Meu Painel SECI</span>
        {dados.foto_url ? (
          <img src={assetUrl(dados.foto_url)} alt="" className="w-7 h-7 rounded-full object-cover border border-white/40" />
        ) : (
          <AvatarPlaceholder nome={dados.nome_completo} size={28} />
        )}
      </header>

      {/* drawer mobile */}
      {menuAberto && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuAberto(false)} />
          <Sidebar dados={dados} onSair={handleSair} onNavegar={() => setMenuAberto(false)} />
          <button type="button" onClick={() => setMenuAberto(false)} aria-label="Fechar" className="absolute top-4 right-4 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* sidebar desktop */}
      <div className="hidden md:block flex-shrink-0">
        <Sidebar dados={dados} onSair={handleSair} />
      </div>

      <main className="flex-1 min-w-0 pt-14 md:pt-0 px-4 sm:px-8 py-6 sm:py-10 max-w-3xl mx-auto w-full">
        <Outlet context={{ dados, setDados, recarregar }} />
      </main>
    </div>
  );
}

function Sidebar({ dados, onSair, onNavegar }) {
  return (
    <aside className="w-64 min-h-screen flex flex-col" style={{ backgroundColor: NAVY }}>
      <div className="p-5 flex items-center gap-3 border-b border-white/10">
        {dados.foto_url ? (
          <img src={assetUrl(dados.foto_url)} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${GOLD}` }} />
        ) : (
          <AvatarPlaceholder nome={dados.nome_completo} size={44} className="border-2" style={{ borderColor: GOLD }} />
        )}
        <div className="min-w-0">
          <p className="text-white font-bold text-sm truncate">{dados.nome_completo?.split(' ').slice(0, 2).join(' ')}</p>
          <p className="text-white/50 text-[11px]">Associado SECI</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {LINKS.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavegar}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`
            }
            style={({ isActive }) => (isActive ? { backgroundColor: 'rgba(212,175,55,0.15)', color: GOLD } : undefined)}
          >
            <Icon className="w-4 h-4" /> {label}
          </NavLink>
        ))}
        <a
          href={`/marketplace?associado=${dados.carteirinha_hash}`}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ShoppingBag className="w-4 h-4" /> Marketplace
        </a>
      </nav>

      <div className="p-3 border-t border-white/10">
        <button
          type="button" onClick={onSair}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </aside>
  );
}
