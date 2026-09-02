import { Search } from 'lucide-react';
import { DOURADO } from '../theme';

const BAIRROS = ['Todos', 'Centro', 'Setor Sul', 'Setor Norte', 'Vila Nova', 'Setor Comercial'];

const campoCls = 'h-14 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-slate-400 transition-colors duration-300';

function buscar(e) {
  e.preventDefault();
  document.querySelector('#parceiros')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function SearchFilterBar({ categorias, categoriaAtiva, setCategoriaAtiva, bairroAtivo, setBairroAtivo, searchQuery, setSearchQuery }) {
  return (
    <div className="max-w-5xl mx-auto px-8 lg:px-16 -mt-8 relative z-10">
      <form
        onSubmit={buscar}
        className="rounded-3xl shadow-xl p-6 grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.4fr_auto] gap-3"
        style={{ backgroundColor: '#F5F5F7' }}
      >
        <select
          value={categoriaAtiva}
          onChange={(e) => setCategoriaAtiva(e.target.value)}
          className={campoCls}
          aria-label="Categoria"
        >
          {categorias.map((c) => (
            <option key={c.label} value={c.label}>{c.label}</option>
          ))}
        </select>

        <select
          value={bairroAtivo}
          onChange={(e) => setBairroAtivo(e.target.value)}
          className={campoCls}
          aria-label="Bairro"
        >
          {BAIRROS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Ex: pizza, ótica, hotel..."
          className={campoCls}
        />

        <button
          type="submit"
          className="h-14 px-8 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg"
          style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
        >
          <Search className="w-4 h-4" /> Buscar
        </button>
      </form>
    </div>
  );
}
