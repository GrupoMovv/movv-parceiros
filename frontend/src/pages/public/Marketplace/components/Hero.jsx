import { Search, X } from 'lucide-react';
import { PRETO } from '../theme';

export default function Hero({ searchQuery, setSearchQuery, qtdParceiros, qtdAssociados }) {
  return (
    <section className="px-8 lg:px-16 pt-14 sm:pt-20 pb-10 sm:pb-14 max-w-5xl mx-auto">
      <h1
        className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]"
        style={{ color: PRETO }}
      >
        Descubra Itumbiara
      </h1>
      <p className="text-slate-500 text-base sm:text-lg mt-4 max-w-lg" style={{ lineHeight: 1.6 }}>
        Ofertas, serviços e benefícios exclusivos pra você.
      </p>

      <div className="relative mt-8 max-w-xl">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar produtos, serviços..."
          className="w-full bg-white border border-slate-200 rounded-2xl pr-11 py-4 text-base text-slate-800 placeholder:text-slate-400 shadow-[0_2px_16px_rgba(15,15,20,0.06)] outline-none focus:border-slate-300 focus:shadow-[0_2px_20px_rgba(15,15,20,0.1)] transition-shadow"
          style={{ paddingLeft: '3.25rem' }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
            aria-label="Limpar busca"
          >
            <X className="w-3 h-3 text-slate-500" />
          </button>
        )}
      </div>

      <p className="text-slate-400 text-sm mt-5 font-medium">
        {qtdParceiros} parceiros{qtdAssociados ? ` · ${qtdAssociados} associados` : ''}
      </p>
    </section>
  );
}
