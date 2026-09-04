import { Link } from 'react-router-dom';
import { Pill, Sparkle, ForkKnife, Wrench, Barbell, House, TShirt, Laptop, CaretRight } from '@phosphor-icons/react';
import { PRETO } from '../theme';

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

function SkeletonItem() {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 py-2 animate-pulse">
      <div className="w-6 h-6 rounded-full bg-slate-100" />
      <div className="w-10 h-2 rounded-full bg-slate-100" />
    </div>
  );
}

// Faixa fina de categorias — substitui os cards grandes coloridos de antes.
// Ícones Phosphor duotone pequenos, sem fundo colorido, alta densidade.
export default function CategoriaFaixa({ categorias, carregando }) {
  return (
    <section id="categorias" className="scroll-mt-16 border-b border-slate-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 flex items-center gap-1 overflow-x-auto scrollbar-none py-1.5">
        {carregando ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonItem key={i} />)
        ) : (
          <>
            {categorias.map(c => {
              const Icone = ICONES[c.slug] || Sparkle;
              return (
                <Link
                  key={c.slug}
                  to={`/marketplace/categoria/${c.slug}`}
                  className="group flex flex-col items-center gap-1 flex-shrink-0 w-16 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Icone size={24} weight="duotone" style={{ color: PRETO }} />
                  <span className="text-[10px] font-medium text-center leading-tight truncate w-full text-slate-600">
                    {c.label}
                  </span>
                </Link>
              );
            })}
            <Link
              to="/marketplace/categoria/todas"
              className="flex flex-col items-center justify-center gap-1 flex-shrink-0 w-12 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-slate-400"
              aria-label="Ver todas as categorias"
            >
              <CaretRight size={18} weight="bold" />
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
