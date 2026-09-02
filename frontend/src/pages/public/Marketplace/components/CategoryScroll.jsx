import { normalizarCategoria } from '../parceirosData';
import { ROXO_ESCURO } from '../theme';

// Cor de fundo por categoria — puramente visual, ciclo de paleta harmônica com o roxo/dourado.
const CORES = ['#EDE9FE', '#FEF3C7', '#DBEAFE', '#DCFCE7', '#FCE7F3', '#FFE4D5', '#E0F2FE', '#F3E8FF'];

export default function CategoryScroll({ categorias, ativa, onSelecionar }) {
  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-100 py-3">
      <div className="max-w-5xl mx-auto px-4 flex gap-4 overflow-x-auto scrollbar-none">
        {categorias.map((c, i) => {
          const selecionada = normalizarCategoria(ativa) === normalizarCategoria(c.label);
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => onSelecionar(c.label)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 group"
            >
              <span
                className="w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all duration-200"
                style={{
                  backgroundColor: selecionada ? ROXO_ESCURO : CORES[i % CORES.length],
                  transform: selecionada ? 'scale(1.08)' : 'scale(1)',
                  boxShadow: selecionada ? '0 6px 16px rgba(59,10,120,0.35)' : 'none',
                }}
              >
                {c.emoji || '🏬'}
              </span>
              <span
                className="text-[11px] font-semibold leading-tight text-center truncate w-full"
                style={{ color: selecionada ? ROXO_ESCURO : '#6B7280' }}
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
