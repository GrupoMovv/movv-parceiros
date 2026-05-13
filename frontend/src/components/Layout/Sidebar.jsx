import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, FileText, UserPlus, Users, ClipboardList,
  Coins, CreditCard, Package, LogOut, ChevronRight, BookOpen, ShieldCheck, UsersRound
} from 'lucide-react';

const partnerLinks = [
  { to: '/',        icon: LayoutDashboard, label: 'Painel' },
  { to: '/extrato', icon: FileText,        label: 'Extrato' },
  { to: '/indicar', icon: UserPlus,        label: 'Indicar Cliente' },
];

const adminLinks = [
  { to: '/admin',              icon: LayoutDashboard, label: 'Visão Geral' },
  { to: '/admin/parceiros',    icon: Users,           label: 'Parceiros' },
  { to: '/admin/indicacoes',   icon: ClipboardList,   label: 'Indicações' },
  { to: '/admin/comissoes',    icon: Coins,           label: 'Comissões' },
  { to: '/admin/pagamentos',   icon: CreditCard,      label: 'Pagamentos' },
  { to: '/admin/produtos',     icon: Package,         label: 'Produtos' },
];

function NavItem({ to, icon: Icon, label, onClose, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
        ${isActive
          ? 'bg-gold-gradient text-movv-900 shadow-gold'
          : 'text-white/75 hover:bg-white/10 hover:text-white'}`
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
  );
}

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const isAccounting = user?.is_admin || user?.type === 'accounting';
  const mainLinks    = user?.is_admin ? adminLinks : partnerLinks;

  const tierColor = {
    Bronze: 'text-amber-300', Prata: 'text-slate-300', Ouro: 'text-gold-300', Diamante: 'text-blue-300'
  };

  return (
    <aside className="h-full flex flex-col bg-movv-900 w-64">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img
            src="/logo-header.png"
            alt="Grupo Movv"
            style={{ height: '40px', width: 'auto' }}
            className="drop-shadow-md flex-shrink-0"
          />
          <div>
            <p className="text-white font-bold text-lg leading-none">Movv</p>
            <p className="text-white/60 text-xs font-medium">Parceiros</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="bg-movv-800/60 rounded-xl p-3">
          <p className="text-white font-semibold text-sm truncate">{user?.name}</p>
          <p className="text-gold-300 text-xs font-mono mt-0.5">{user?.code}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`text-xs font-medium ${tierColor[user?.tier] || 'text-amber-300'}`}>
              {user?.is_admin
                ? '⚙ Administrador'
                : `◆ Parceiro ${user?.type === 'accounting' ? 'Contabilidade' : 'Funcionário'}`}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {user?.is_admin && (
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider px-3 mb-2">Admin</p>
        )}

        {mainLinks.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} onClose={onClose}
            end={to === '/' || to === '/admin'} />
        ))}

        {/* Meus Funcionários — visível apenas para contabilidade (não admin) */}
        {!user?.is_admin && user?.type === 'accounting' && (
          <NavItem to="/meus-funcionarios" icon={UsersRound} label="Meus Funcionários" onClose={onClose} />
        )}

        {/* Seção de recursos — visível a todos */}
        <div className="pt-3 mt-3 border-t border-white/10">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider px-3 mb-2">Recursos</p>
          <NavItem to="/material-apoio" icon={BookOpen} label="Material de Apoio" onClose={onClose} />
          {isAccounting && (
            <NavItem to="/direta-certificacao" icon={ShieldCheck} label="Direta Certificação" onClose={onClose} />
          )}
        </div>
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                     text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
