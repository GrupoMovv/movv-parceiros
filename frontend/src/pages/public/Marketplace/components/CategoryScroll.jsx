import {
  LayoutGrid, ShoppingBag, Wrench, UtensilsCrossed, Shirt, Home as HomeIcon,
  Car, Laptop, Sparkles, Gift, GraduationCap, Dumbbell, HeartPulse, BedDouble, Brain,
} from 'lucide-react';
import { normalizarCategoria } from '../parceirosData';
import { PRETO } from '../theme';

const ICONES = {
  Todas: LayoutGrid,
  Produtos: ShoppingBag,
  Serviços: Wrench,
  Alimentação: UtensilsCrossed,
  Moda: Shirt,
  Casa: HomeIcon,
  Automotivo: Car,
  Tecnologia: Laptop,
  Beleza: Sparkles,
  Presentes: Gift,
  Educação: GraduationCap,
  Esportes: Dumbbell,
  Saúde: HeartPulse,
  Hotelaria: BedDouble,
  'Bem-estar': Brain,
};

export default function CategoryScroll({ categorias, ativa, onSelecionar }) {
  return (
    <div className="sticky top-[70px] z-30 bg-white/85 backdrop-blur-md border-b border-slate-100 py-3">
      <div className="max-w-5xl mx-auto px-8 lg:px-16 flex gap-1 overflow-x-auto scrollbar-none">
        {categorias.map((c) => {
          const Icone = ICONES[c.label] || LayoutGrid;
          const selecionada = normalizarCategoria(ativa) === normalizarCategoria(c.label);
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => onSelecionar(c.label)}
              className={`flex flex-col items-center gap-1.5 flex-shrink-0 w-16 py-2 rounded-xl transition-colors ${selecionada ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
            >
              <Icone className="w-5 h-5" strokeWidth={1.75} style={{ color: selecionada ? PRETO : '#94A3B8' }} />
              <span
                className="text-[11px] font-medium leading-tight text-center truncate w-full"
                style={{ color: selecionada ? PRETO : '#94A3B8' }}
              >
                {c.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
