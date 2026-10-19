import { Diamond } from '@phosphor-icons/react';
import { DOURADO, ROXO_ESCURO } from '../theme';

// Selo da Loja do Clube (b4): o benefício que a loja dá a quem é do Clube
// MAIS+ — "Clube 10%", "Clube até 15%" (só produtos escolhidos) ou "Clube ·
// entrega grátis". `clube` vem da API ({ percentual, alcance, entrega_gratis })
// ou null (loja fora do Clube: não mostra nada). No tamanho 'lg' (página da
// loja) a entrega grátis aparece junto do percentual.
export function textoClube(clube, longo = false) {
  if (!clube) return null;
  const pct = clube.percentual != null ? Number(clube.percentual).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : null;
  if (!pct) return clube.entrega_gratis ? 'Clube · entrega grátis' : null;
  const base = `Clube ${clube.alcance === 'escolhidos' ? 'até ' : ''}${pct}%`;
  return longo && clube.entrega_gratis ? `${base} + entrega grátis` : base;
}

export default function SeloClube({ clube, size = 'sm', className = '' }) {
  const texto = textoClube(clube, size === 'lg');
  if (!texto) return null;
  const tamanho = size === 'lg' ? 'text-sm px-4 py-1.5 gap-1.5' : 'text-[10px] px-2.5 py-1 gap-1';
  // texto longo ("Clube · entrega grátis") quebra linha no card estreito do celular
  const longo = size !== 'lg' && texto.length > 14;
  return (
    <span
      className={`inline-flex items-center font-black uppercase tracking-wide max-w-full ${longo ? 'rounded-lg leading-tight' : 'rounded-full whitespace-nowrap'} ${tamanho} ${className}`}
      style={{ backgroundColor: ROXO_ESCURO, color: '#fff', boxShadow: `inset 0 0 0 1px ${DOURADO}88` }}
      title="Desconto para quem é do Clube MAIS+"
    >
      <Diamond size={size === 'lg' ? 14 : 10} weight="fill" color={DOURADO} className="flex-shrink-0" /> <span>{texto}</span>
    </span>
  );
}
