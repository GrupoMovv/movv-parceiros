import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import {
  LayoutDashboard, FileText, UserPlus, Users, ClipboardList,
  Coins, CreditCard, Package, LogOut, ChevronRight, BookOpen, ShieldCheck, UsersRound,
  Building2, TrendingUp, Sparkles, ShoppingCart, DollarSign, Coffee, KeyRound, Lock,
  Landmark, Gift, MessagesSquare, Contact, Inbox, Store, Bell, UserCheck,
} from 'lucide-react';

// ─── Roles ────────────────────────────────────────────────────────────────────

function getUserRoles(user) {
  if (!user) return [];
  const roles = [];
  if (user.is_admin) roles.push('admin');
  if (user.type === 'accounting') roles.push('accounting');
  if (user.type === 'indicator') roles.push('indicator');
  if (user.type === 'internal') {
    roles.push('internal');
    // Papel específico dentro de "internal" — usado para itens exclusivos de um colaborador.
    if (user.role) roles.push(user.role);
  }
  // qualquer parceiro que não seja accounting, indicator ou internal
  if (!user.is_admin && !['accounting', 'indicator', 'internal'].includes(user.type)) {
    roles.push('partner');
  }
  return roles;
}

function canAccess(item, userRoles) {
  if (item.alwaysEnabled) return true;
  if (!item.roles?.length) return false;
  return item.roles.some(r => userRoles.includes(r));
}

// ─── Master Menu ──────────────────────────────────────────────────────────────

const MASTER_MENU = [
  {
    section: 'Admin',
    items: [
      { label: 'Visão Geral',        icon: LayoutDashboard, to: '/admin',                   roles: ['admin'], end: true },
      { label: 'Parceiros',          icon: Users,           to: '/admin/parceiros',          roles: ['admin'] },
      { label: 'Indicações',         icon: ClipboardList,   to: '/admin/indicacoes',         roles: ['admin'] },
      { label: 'Comissões',          icon: Coins,           to: '/admin/comissoes',          roles: ['admin'] },
      { label: 'Pagamentos',         icon: CreditCard,      to: '/admin/pagamentos',         roles: ['admin'] },
      { label: 'Produtos',           icon: Package,         to: '/admin/produtos',           roles: ['admin'] },
      { label: 'Comissões Internas', icon: DollarSign,      to: '/admin/comissoes-internas', roles: ['admin'] },
      { label: 'Indicadores',        icon: UsersRound,      to: '/admin/indicadores',        roles: ['admin'] },
      { label: 'Interesses',         icon: Sparkles,        to: '/admin/interesse',          roles: ['admin'] },
      { label: 'Movv Certificado — Painel',       icon: ShieldCheck, to: '/admin/direta',               roles: ['admin'] },
      { label: 'Movv Certificado — Vendas',       icon: FileText,    to: '/admin/direta/vendas',        roles: ['admin'] },
      { label: 'Movv Certificado — Contabilidades', icon: Building2, to: '/admin/direta/contabilidades', roles: ['admin'] },
      { label: 'Sindicato — Renan',  icon: Landmark,     to: '/admin/sindicato',            roles: ['admin'] },
      { label: 'Empresas Contribuintes', icon: Building2, to: '/admin/empresas-contribuintes', roles: ['admin'] },
      { label: 'Templates Benefícios', icon: MessagesSquare, to: '/sindicato/beneficios/templates', roles: ['admin'] },
    ],
  },
  {
    section: 'Portal Parceiro',
    items: [
      { label: 'Painel',              icon: LayoutDashboard, to: '/',                   roles: ['admin', 'accounting', 'partner'], end: true },
      { label: 'Extrato',             icon: FileText,        to: '/extrato',             roles: ['admin', 'accounting', 'partner'] },
      { label: 'Indicar Cliente',     icon: UserPlus,        to: '/indicar',             roles: ['admin', 'accounting', 'partner'] },
      { label: 'Material de Apoio',   icon: BookOpen,        to: '/material-apoio',      roles: ['admin', 'accounting', 'partner'] },
      { label: 'Direta Certificação', icon: ShieldCheck,     to: '/direta-certificacao', roles: ['admin', 'accounting'] },
      { label: 'Meus Funcionários',   icon: UsersRound,      to: '/meus-funcionarios',   roles: ['admin', 'accounting'] },
    ],
  },
  {
    section: 'Indicador Azul',
    items: [
      { label: 'Painel Indicador',  icon: LayoutDashboard, to: '/indicador/dashboard',         roles: ['indicator'], end: true },
      { label: 'Indicar',           icon: UserPlus,        to: '/indicador/indicar',            roles: ['indicator'] },
      { label: 'Minhas Indicações', icon: ClipboardList,   to: '/indicador/minhas-indicacoes',  roles: ['indicator'] },
      { label: 'Produtos Azul',     icon: Package,         to: '/indicador/produtos-azul',      roles: ['indicator'] },
      { label: 'Simulador',         icon: TrendingUp,      to: '/indicador/simulador',          roles: ['indicator'] },
      { label: 'Material de Apoio', icon: BookOpen,        to: '/indicador/material-apoio',     roles: ['indicator'] },
      { label: 'Meus Pagamentos',   icon: CreditCard,      to: '/indicador/meus-pagamentos',    roles: ['indicator'] },
      { label: 'Meu Perfil',        icon: Users,           to: '/indicador/perfil',             roles: ['indicator'] },
    ],
  },
  {
    section: 'Colaborador',
    items: [
      { label: 'Minhas Comissões', icon: DollarSign,   to: '/minhas-comissoes',    roles: ['manager_azul'] },
      { label: 'Meu Painel',       icon: LayoutDashboard, to: '/direta/dashboard',    roles: ['comercial_full'], end: true },
      { label: 'Minhas Vendas',    icon: FileText,     to: '/direta/minhas-vendas', roles: ['comercial_full'] },
      { label: 'Atividades',       icon: ClipboardList, to: '/direta/atividades',   roles: ['comercial_full'] },
      { label: 'Contabilidades',   icon: Building2,     to: '/direta/contabilidades', roles: ['comercial_full'] },
      { label: 'Minha Comissão',   icon: Landmark,      to: '/sindicato/minha-comissao', roles: ['sindicato_aprendiz'] },
      { label: 'Empresas',         icon: Building2,     to: '/sindicato/empresas',       roles: ['sindicato_aprendiz', 'admin'] },
      { label: 'Associados',       icon: Contact,       to: '/sindicato/associados',      roles: ['sindicato_aprendiz', 'admin'] },
      { label: 'Lista Aprovados',  icon: UserCheck,     to: '/sindicato/lista-aprovados', roles: ['sindicato_aprendiz', 'admin'] },
      { label: 'Carteirinhas',     icon: CreditCard,    to: '/sindicato/carteirinhas',    roles: ['sindicato_aprendiz', 'admin'] },
      { label: 'Benefícios',       icon: Gift,          to: '/sindicato/beneficios',      roles: ['sindicato_aprendiz', 'admin'] },
      { label: 'Solicitações de Empresas', icon: Inbox, to: '/sindicato/solicitacoes',    roles: ['sindicato_aprendiz', 'admin'], badgeKey: 'solicitacoes' },
      { label: 'Solicitações de Parceiros IUB MAIS', icon: Store, to: '/sindicato/parceiros-solicitacoes', roles: ['sindicato_aprendiz', 'admin'], badgeKey: 'parceirosSolicitacoes' },
      { label: 'Interessados em Planos', icon: Bell, to: '/sindicato/parceiro-interessados', roles: ['sindicato_aprendiz', 'admin'] },
    ],
  },
  {
    section: 'Recursos',
    items: [
      { label: 'Movv Café',         icon: Coffee,       to: '/movv-cafe',          alwaysEnabled: true },
      { label: 'Movv Office',       icon: Building2,    to: '/movv-office',        alwaysEnabled: true, comingSoon: true },
      { label: 'Movv Cobranças',    icon: TrendingUp,   to: '/movv-cobrancas',     alwaysEnabled: true, comingSoon: true },
      { label: 'Movv Suprimentos',  icon: ShoppingCart, to: '/movv-suprimentos',   alwaysEnabled: true, comingSoon: true },
    ],
  },
];

// ─── Nav Items ────────────────────────────────────────────────────────────────

function NavItem({ to, icon: Icon, label, onClose, end, badge }) {
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
          {!!badge && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${isActive ? 'bg-movv-900 text-white' : 'bg-red-500 text-white'}`}>
              {badge}
            </span>
          )}
          {isActive && <ChevronRight className="w-3 h-3 text-movv-900" />}
        </>
      )}
    </NavLink>
  );
}

function LockedItem({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium opacity-30 cursor-not-allowed select-none">
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 text-white/60">{label}</span>
      <Lock className="w-3 h-3 flex-shrink-0 text-white/40" />
    </div>
  );
}

function ComingSoonItem({ to, icon: Icon, label, onClose }) {
  return (
    <NavLink
      to={to}
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
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#C9A84C] text-[#0C2D48] leading-none">
            BREVE
          </span>
        </>
      )}
    </NavLink>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const userRoles = getUserRoles(user);

  const isInternal  = user?.type === 'internal';
  const isIndicator = user?.type === 'indicator';

  const [badges, setBadges] = useState({});
  const podeVerSolicitacoes = user?.is_admin || (isInternal && user?.role === 'sindicato_aprendiz');

  useEffect(() => {
    if (!podeVerSolicitacoes) return;
    let cancelado = false;
    const carregar = () => {
      api.get('/sindicato-solicitacoes/count-pendentes')
        .then(res => { if (!cancelado) setBadges(b => ({ ...b, solicitacoes: res.data.pendentes })); })
        .catch(() => {});
      api.get('/sindicato-parceiros-solicitacoes/count-pendentes')
        .then(res => { if (!cancelado) setBadges(b => ({ ...b, parceirosSolicitacoes: res.data.pendentes })); })
        .catch(() => {});
    };
    carregar();
    const interval = setInterval(carregar, 60000);
    return () => { cancelado = true; clearInterval(interval); };
  }, [podeVerSolicitacoes]);

  const tierColor = {
    Bronze: 'text-amber-300', Prata: 'text-slate-300', Ouro: 'text-gold-300', Diamante: 'text-blue-300',
  };

  function handleLogout() {
    logout();
    navigate('/login');
  }

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
          {user?.code && <p className="text-gold-300 text-xs font-mono mt-0.5">{user?.code}</p>}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`text-xs font-medium ${tierColor[user?.tier] || 'text-amber-300'}`}>
              {user?.is_admin
                ? '⚙ Administrador'
                : isInternal
                  ? (user?.role === 'manager_azul'
                      ? '★ Gerente Azul'
                      : user?.role === 'sindicato_aprendiz'
                        ? '★ Sindicato — Menor Aprendiz'
                        : '★ Comercial Azul + Movv Certificado')
                  : isIndicator
                    ? '◆ Indicador Azul'
                    : `◆ Parceiro ${user?.type === 'accounting' ? 'Contabilidade' : 'Funcionário'}`}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-3">
        {MASTER_MENU.map(({ section, items }) => (
          <div key={section}>
            <p className="text-white/35 text-[10px] font-bold uppercase tracking-widest px-3 mb-1">
              {section}
            </p>
            <div className="space-y-0.5">
              {items.map(item => {
                if (item.comingSoon) {
                  return (
                    <ComingSoonItem
                      key={item.to}
                      to={item.to}
                      icon={item.icon}
                      label={item.label}
                      onClose={onClose}
                    />
                  );
                }
                if (canAccess(item, userRoles)) {
                  return (
                    <NavItem
                      key={item.to}
                      to={item.to}
                      icon={item.icon}
                      label={item.label}
                      onClose={onClose}
                      end={item.end}
                      badge={item.badgeKey ? badges[item.badgeKey] : undefined}
                    />
                  );
                }
                return <LockedItem key={item.to} icon={item.icon} label={item.label} />;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Alterar Senha + Logout */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <NavItem to="/alterar-senha" icon={KeyRound} label="Alterar Senha" onClose={onClose} />
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
