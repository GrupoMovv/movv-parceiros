import { Link } from 'react-router-dom';
import { Pill, Sparkle, ForkKnife, Wrench, Barbell, House, TShirt, Laptop } from '@phosphor-icons/react';
import { ROXO, PRETO } from '../theme';

const ICONES = {
  saude: Pill,
  beleza: Sparkle,
  alimentacao: ForkKnife,
  servicos: Wrench,
  fitness: Barbell,
  casa: House,
  moda: TShirt,
  tecnologia: Laptop,
};

export default function CardCategoria({ categoria }) {
  const Icone = ICONES[categoria.slug] || Sparkle;

  return (
    <Link
      to={`/marketplace/categoria/${categoria.slug}`}
      className="group flex flex-col items-center gap-2 flex-shrink-0 w-24 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105"
    >
      <Icone size={32} weight="duotone" color={ROXO} />
      <span className="text-xs font-medium text-center leading-tight" style={{ color: PRETO }}>
        {categoria.label}
      </span>
      {categoria.count > 0 && (
        <span className="text-[10px] text-slate-400 -mt-1">{categoria.count} parceiro{categoria.count > 1 ? 's' : ''}</span>
      )}
    </Link>
  );
}
