import { Link } from 'react-router-dom';
import { PRETO } from '../theme';

// Paleta fixa por categoria — só decorativa (círculo grande colorido atrás
// do emoji), não precisa vir do backend.
const CORES = {
  saude: '#10B981',
  beleza: '#EC4899',
  alimentacao: '#F97316',
  servicos: '#0EA5E9',
  fitness: '#F43F5E',
  casa: '#8B5CF6',
  moda: '#EAB308',
  tecnologia: '#3B82F6',
};

export default function CardCategoria({ categoria }) {
  const cor = CORES[categoria.slug] || '#64748B';

  return (
    <Link
      to={`/marketplace/categoria/${categoria.slug}`}
      className="group flex flex-col items-center gap-2 flex-shrink-0 w-20 sm:w-24"
    >
      <div
        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-3xl sm:text-4xl shadow-sm transition-transform duration-300 group-hover:scale-105"
        style={{ backgroundColor: `${cor}1A` }}
      >
        {categoria.emoji}
      </div>
      <span className="text-xs font-semibold text-center leading-tight" style={{ color: PRETO }}>
        {categoria.label}
      </span>
      {categoria.count > 0 && (
        <span className="text-[10px] text-slate-400 -mt-1.5">{categoria.count} parceiro{categoria.count > 1 ? 's' : ''}</span>
      )}
    </Link>
  );
}
