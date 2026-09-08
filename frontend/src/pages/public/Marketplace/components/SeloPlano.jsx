import { Diamond, Trophy, Sparkle } from '@phosphor-icons/react';
import { DOURADO, DOURADO_ESCURO, ROXO_ESCURO } from '../theme';

// Mapeamento só de exibição (emoji/ícone/rótulo) — a REGRA de quem tem
// direito a cada selo mora em backend/src/config/planos.js (`tem_selo`,
// `selo_nome`); aqui só decide como desenhar o `plano` que a API já manda
// pronto (efetivo, com o seed de demonstração aplicado).
const CONFIG = {
  oficial: { label: 'Oficial', emoji: '💎', Icon: Diamond },
  premium: { label: 'Premium', emoji: '🏆', Icon: Trophy },
  master: { label: 'Master VIP', emoji: '🌟', Icon: Sparkle },
};

// Selo visual do plano do parceiro. Grátis não ganha destaque nenhum por
// padrão (`mostrarGratis` liga o texto cinza discreto pra quando faz
// sentido mostrar mesmo assim, ex: página do parceiro). `size`: 'sm' pros
// cards de vitrine, 'lg' pro topo da página do parceiro.
export default function SeloPlano({ plano, size = 'sm', mostrarGratis = false, className = '' }) {
  if (!plano || plano === 'gratis') {
    if (!mostrarGratis) return null;
    return <span className={`text-xs text-gray-500 ${className}`}>Parceiro IUB</span>;
  }

  const cfg = CONFIG[plano];
  if (!cfg) return null;

  const isMaster = plano === 'master';
  const isPremium = plano === 'premium';
  const { Icon } = cfg;
  const tamanhoTexto = size === 'lg' ? 'text-sm px-4 py-1.5 gap-1.5' : 'text-[10px] px-2.5 py-1 gap-1';
  const tamanhoIcone = size === 'lg' ? 14 : 10;

  return (
    <span
      className={`inline-flex items-center font-black uppercase tracking-wide rounded-full whitespace-nowrap ${tamanhoTexto} ${isMaster ? 'animate-pulse' : ''} ${className}`}
      style={{
        background: isMaster
          ? `linear-gradient(135deg, ${DOURADO_ESCURO} 0%, ${DOURADO} 45%, #FFE9A8 55%, ${DOURADO} 100%)`
          : `linear-gradient(135deg, ${DOURADO_ESCURO} 0%, ${DOURADO} 100%)`,
        color: ROXO_ESCURO,
        boxShadow: isMaster ? `0 0 14px ${DOURADO}AA` : isPremium ? '0 2px 8px rgba(15,15,20,0.18)' : '0 1px 3px rgba(15,15,20,0.12)',
      }}
    >
      <Icon size={tamanhoIcone} weight="fill" /> {cfg.emoji} {cfg.label}
    </span>
  );
}
