import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CaretDown } from '@phosphor-icons/react';
import { BEER } from '../../pages/beer/beerConfig';

// Grade completa grupo -> categorias. No celular cada grupo é um acordeão
// (fechado); do sm pra cima tudo aberto. Cigarros vem com aviso de
// categoria regulamentada.
export default function TodasCategorias({ grupos }) {
  const [aberto, setAberto] = useState(null);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {grupos.map(g => {
        const expandido = aberto === g.codigo;
        return (
          <div key={g.codigo} className="rounded-2xl" style={{ backgroundColor: BEER.painel, border: `1px solid ${BEER.borda}` }}>
            <div className="flex items-center gap-2 px-4 py-3">
              <Link to={`/beer/categoria/${g.codigo}`} className="flex-1 min-w-0 flex items-center gap-2 group">
                <span className="text-xl" aria-hidden="true">{g.icone}</span>
                <span className="text-sm font-bold text-white group-hover:underline truncate">{g.nome}</span>
                {g.total > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(124,58,237,0.35)', color: BEER.lavanda }}>{g.total}</span>}
              </Link>
              <button
                type="button"
                onClick={() => setAberto(expandido ? null : g.codigo)}
                aria-expanded={expandido}
                aria-label={`${expandido ? 'Fechar' : 'Abrir'} ${g.nome}`}
                className="sm:hidden p-1.5 rounded-lg"
                style={{ color: BEER.lavanda }}
              >
                <CaretDown size={16} weight="bold" className={`transition-transform ${expandido ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <div className={`${expandido ? 'flex' : 'hidden'} sm:flex flex-wrap gap-1.5 px-4 pb-4`}>
              {g.regulamentada && <p className="w-full text-[10px] mb-1" style={{ color: '#FCA5A5' }}>Categoria regulamentada · venda só para maiores de 18</p>}
              {g.filhas.map(f => (
                <Link
                  key={f.codigo}
                  to={`/beer/categoria/${f.codigo}`}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors hover:bg-white/10"
                  style={{ color: f.total > 0 ? '#fff' : BEER.lavandaFraca, border: `1px solid ${BEER.borda}` }}
                >
                  {f.nome}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
