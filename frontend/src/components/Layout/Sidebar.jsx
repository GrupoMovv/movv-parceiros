import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, FileText, UserPlus, Users, ClipboardList,
  CreditCard, Package, LogOut, ChevronRight
} from 'lucide-react';

const partnerLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Painel' },
  { to: '/extrato', icon: FileText, label: 'Extrato' },
  { to: '/indicar', icon: UserPlus, label: 'Indicar Cliente' },
];

const adminLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'Visão Geral' },
  { to: '/admin/parceiros', icon: Users, label: 'Parceiros' },
  { to: '/admin/indicacoes', icon: ClipboardList, label: 'Indicações' },
  { to: '/admin/pagamentos', icon: CreditCard, label: 'Pagamentos' },
  { to: '/admin/produtos', icon: Package, label: 'Produtos' },
];

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const links = user?.is_admin ? adminLinks : partnerLinks;
  const tierColor = {
    Bronze: 'text-amber-600', Prata: 'text-gray-400', Ouro: 'text-gold-400', Diamante: 'text-blue-400'
  };

  return (
    <aside className="h-full flex flex-col bg-movv-900 border-r border-movv-700 w-64">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-movv-700">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png.png"
            alt="Grupo Movv"
            style={{ height: '40px', width: 'auto' }}
            className="drop-shadow-md flex-shrink-0"
          />
          <div>
            <p className="text-gradient font-bold text-lg leading-none">Movv</p>
            <p className="text-movv-400 text-xs font-medium">Parceiros</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 py-4 border-b border-movv-700">
        <div className="bg-movv-800 rounded-xl p-3">
          <p className="text-white font-semibold text-sm truncate">{user?.name}</p>
          <p className="text-gold-500 text-xs font-mono mt-0.5">{user?.code}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`text-xs font-medium ${tierColor[user?.tier] || 'text-amber-600'}`}>
              {user?.is_admin ? '⚙ Administrador' : `◆ Parceiro ${user?.type === 'accounting' ? 'Contabilidade' : 'Funcionário'}`}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {user?.is_admin && (
          <p className="text-movv-500 text-xs font-semibold uppercase tracking-wider px-3 mb-2">Admin</p>
        )}
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/' || to === '/admin'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
              ${isActive
                ? 'bg-gold-gradient text-movv-900 shadow-gold'
                : 'text-movv-300 hover:bg-movv-800 hover:text-white'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-movv-900' : ''}`} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight className="w-3 h-3 text-movv-900" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-movv-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                     text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
