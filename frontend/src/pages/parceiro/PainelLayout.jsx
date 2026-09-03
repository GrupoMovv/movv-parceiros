import { useEffect, useState, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import apiParceiro, { getParceiroToken, setParceiroToken } from '../../services/apiParceiro';
import { ROXO, PRETO } from '../public/Marketplace/theme';

const ABAS = [
  { label: 'Dashboard', to: '/parceiro/painel', end: true },
  { label: 'Meu Perfil', to: '/parceiro/painel/perfil' },
  { label: 'Produtos', to: '/parceiro/painel/produtos' },
  { label: 'Promoções', to: '/parceiro/painel/promocoes' },
  { label: 'Estatísticas', to: '/parceiro/painel/estatisticas' },
  { label: 'Planos', to: '/parceiro/painel/planos' },
  { label: 'Configurações', to: '/parceiro/painel/configuracoes' },
];

export default function ParceiroPainelLayout() {
  const navigate = useNavigate();
  const [parceiro, setParceiro] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [menuAberto, setMenuAberto] = useState(false);
  const [promosTerminandoEm24h, setPromosTerminandoEm24h] = useState(0);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!getParceiroToken()) {
      navigate('/parceiro/login', { replace: true });
      return;
    }
    apiParceiro.get('/parceiro/auth/me')
      .then(res => { setParceiro(res.data.parceiro); setUsuario(res.data.usuario); })
      .catch(() => navigate('/parceiro/login', { replace: true }))
      .finally(() => setCarregando(false));
  }, [navigate]);

  // Badge simples de "vai vencer" — reusa a listagem de promoções ativas e
  // filtra no cliente quem termina em menos de 24h (sem endpoint dedicado).
  useEffect(() => {
    if (!getParceiroToken()) return;
    apiParceiro.get('/parceiro/promocoes', { params: { status: 'ativa' } })
      .then(res => {
        const agora = Date.now();
        const emBreve = res.data.promocoes.filter(p => new Date(p.data_fim).getTime() - agora < 24 * 3600 * 1000);
        setPromosTerminandoEm24h(emBreve.length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function fecharAoClicarFora(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAberto(false);
    }
    document.addEventListener('mousedown', fecharAoClicarFora);
    return () => document.removeEventListener('mousedown', fecharAoClicarFora);
  }, []);

  async function handleLogout() {
    try { await apiParceiro.post('/parceiro/auth/logout'); } catch { /* stateless, ignora falha */ }
    setParceiroToken(null);
    toast.success('Sessão encerrada');
    navigate('/parceiro/login', { replace: true });
  }

  if (carregando) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: `${ROXO}33`, borderTopColor: ROXO }} />
      </div>
    );
  }

  if (!parceiro) return null;

  const iniciais = (usuario.email || parceiro.nome || '?').trim()[0].toUpperCase();

  return (
    <div className="min-h-screen w-full bg-slate-50">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <img src="/iub-logo-sm.png" alt="IUB MAIS" className="h-8 w-auto rounded-lg flex-shrink-0" />
          <p className="flex-1 text-center font-bold text-sm truncate" style={{ color: PRETO }}>{parceiro.nome}</p>

          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuAberto(v => !v)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 transition-colors"
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: ROXO }}
              >
                {iniciais}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {menuAberto && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-40">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-sm font-semibold truncate" style={{ color: PRETO }}>{usuario.email}</p>
                  <p className="text-xs text-slate-400 mt-0.5 capitalize">{usuario.cargo}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sair
                </button>
              </div>
            )}
          </div>
        </div>

        <nav className="max-w-6xl mx-auto px-4 sm:px-8 flex gap-1 overflow-x-auto scrollbar-none">
          {ABAS.map(aba => (
            <NavLink
              key={aba.to}
              to={aba.to}
              end={aba.end}
              className={({ isActive }) =>
                `flex-shrink-0 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${isActive ? '' : 'border-transparent text-slate-400 hover:text-slate-600'}`
              }
              style={({ isActive }) => isActive ? { borderColor: ROXO, color: ROXO } : undefined}
            >
              {aba.label}
              {aba.to === '/parceiro/painel/promocoes' && promosTerminandoEm24h > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white bg-red-500">
                  {promosTerminandoEm24h}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        <Outlet context={{ parceiro, usuario }} />
      </main>
    </div>
  );
}
