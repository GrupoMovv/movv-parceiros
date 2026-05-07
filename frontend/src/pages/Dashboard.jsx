import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp, Clock, CheckCircle2, UserPlus,
  ArrowRight, Wallet, Calendar, Star
} from 'lucide-react';

const STATUS_LABELS = {
  pending: { label: 'Pendente', cls: 'badge-pending' },
  converted: { label: 'Convertida', cls: 'badge-converted' },
  expired: { label: 'Expirada', cls: 'badge-expired' },
};

const TIER_CONFIG = {
  Bronze:   { color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200',   min: 0,  max: 4 },
  Prata:    { color: 'text-slate-500',  bg: 'bg-slate-50',   border: 'border-slate-200',   min: 5,  max: 9 },
  Ouro:     { color: 'text-[#C9A84C]', bg: 'bg-[#FDF8ED]',  border: 'border-[#C9A84C]/30',min: 10, max: 19 },
  Diamante: { color: 'text-blue-600',  bg: 'bg-blue-50',    border: 'border-blue-200',    min: 20, max: 999 },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/partners/stats'),
      api.get('/referrals?month=' + new Date().toISOString().slice(0, 7)),
    ]).then(([s, r]) => {
      setStats(s.data);
      setReferrals(r.data.slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-movv-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const tier = stats?.tier || 'Bronze';
  const tierCfg = TIER_CONFIG[tier];
  const progress = Math.min(100, ((stats?.total_referrals - tierCfg.min) / Math.max(1, tierCfg.max - tierCfg.min)) * 100);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Olá, <span className="text-gradient">{user?.name?.split(' ')[0]}</span> 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={<Wallet className="w-5 h-5" />}
          label="Saldo Pendente"
          value={`R$ ${stats?.pending_balance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}`}
          sub="aguardando pagamento"
          accent
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Ganhos este Mês"
          value={`R$ ${stats?.month_earnings?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}`}
          sub={`Próximo PIX: dia ${stats?.next_payment_day}`}
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Total de Indicações"
          value={stats?.total_referrals || 0}
          sub="desde o início"
        />
      </div>

      {/* Tier + CTA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tier card */}
        <div className="card-gold">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Star className={`w-5 h-5 ${tierCfg.color}`} />
              <span className="font-semibold text-slate-900">Faixa de Comissão</span>
            </div>
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${tierCfg.bg} ${tierCfg.color} border ${tierCfg.border}`}>
              {tier}
            </span>
          </div>
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>{stats?.total_referrals} indicações</span>
              <span>{tierCfg.max === 999 ? '∞' : tierCfg.max + 1} para subir</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold-gradient rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4">
            {Object.entries(TIER_CONFIG).map(([name, cfg]) => (
              <div key={name} className={`text-center p-2 rounded-lg border ${name === tier ? `${cfg.bg} ${cfg.border}` : 'border-slate-200 bg-slate-50'}`}>
                <p className={`text-xs font-bold ${name === tier ? cfg.color : 'text-slate-400'}`}>{name}</p>
                <p className="text-slate-400 text-xs">{cfg.min}+</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 mb-1">Ações Rápidas</h3>
            <p className="text-slate-500 text-sm">Gerencie suas indicações</p>
          </div>
          <div className="space-y-3 mt-4">
            <Link to="/indicar" className="btn-primary w-full flex items-center justify-center gap-2">
              <UserPlus className="w-4 h-4" />
              Nova Indicação
            </Link>
            <Link to="/extrato" className="btn-secondary w-full flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Ver Extrato Completo
            </Link>
          </div>
          <div className="mt-4 p-3 bg-[#FDF8ED] rounded-xl border border-[#C9A84C]/30">
            <div className="flex items-center gap-2 text-[#C9A84C] text-sm">
              <Calendar className="w-4 h-4" />
              <span className="text-slate-700">Pagamentos via PIX todo dia <strong>5</strong> do mês</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent referrals */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Últimas Indicações</h3>
          <Link to="/extrato" className="text-[#C9A84C] hover:text-[#D4B85A] text-sm flex items-center gap-1 transition-colors">
            Ver todas <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {referrals.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhuma indicação ainda este mês</p>
            <Link to="/indicar" className="text-[#C9A84C] hover:text-[#D4B85A] text-sm mt-1 inline-block">
              Fazer primeira indicação →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {referrals.map(r => (
              <div key={r.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-slate-900 font-medium text-sm">{r.client_name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{r.product_name} · <span className="font-mono">{r.protocol}</span></p>
                </div>
                <span className={STATUS_LABELS[r.status]?.cls}>{STATUS_LABELS[r.status]?.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className={accent ? 'card-gold' : 'card'}>
      <div className={`inline-flex p-2 rounded-lg mb-3 ${accent ? 'bg-[#FDF8ED] text-[#C9A84C]' : 'bg-purple-50 text-movv-900'}`}>
        {icon}
      </div>
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ? 'text-gradient' : 'text-slate-900'}`}>{value}</p>
      <p className="text-slate-400 text-xs mt-1">{sub}</p>
    </div>
  );
}
