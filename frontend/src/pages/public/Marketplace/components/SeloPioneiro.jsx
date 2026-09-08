import { Star } from '@phosphor-icons/react';
import { DOURADO, DOURADO_ESCURO, ROXO_ESCURO } from '../theme';

// Selo "PIONEIRO" — independente do selo de plano (SeloPlano): um parceiro
// Premium ou Master pode ser Pioneiro ao mesmo tempo, os dois aparecem
// juntos. Vitalício (parceiro.e_pioneiro nunca volta a false), por isso não
// tem variação por plano — é sempre o mesmo brilho dourado forte.
export default function SeloPioneiro({ pioneiro, size = 'sm', className = '' }) {
  if (!pioneiro) return null;

  const tamanhoTexto = size === 'lg' ? 'text-sm px-4 py-1.5 gap-1.5' : 'text-[10px] px-2.5 py-1 gap-1';
  const tamanhoIcone = size === 'lg' ? 14 : 10;

  return (
    <span
      className={`inline-flex items-center font-black uppercase tracking-wide rounded-full whitespace-nowrap animate-pulse ${tamanhoTexto} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${DOURADO_ESCURO} 0%, ${DOURADO} 45%, #FFE9A8 55%, ${DOURADO} 100%)`,
        color: ROXO_ESCURO,
        boxShadow: `0 0 14px ${DOURADO}AA`,
      }}
    >
      <Star size={tamanhoIcone} weight="fill" /> Pioneiro
    </span>
  );
}
