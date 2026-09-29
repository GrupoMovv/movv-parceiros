import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CaretRight } from '@phosphor-icons/react';
import api from '../../services/api';
import CardProduto from './CardProduto';
import { BEER } from '../../pages/beer/beerConfig';

// Home do Disk Bebidas: um carrossel por grupo (Cervejas, Vinhos, Whisky...)
// — padrão iFood/Amazon pra quem não sabe o que buscar. A regra (>= 3
// produtos, ordem, adegas intercaladas, cigarro fora) é do backend
// (GET /public/beer/vitrine). Sem seção nenhuma, não ocupa espaço.
export default function CarrosseisVitrine() {
  const [secoes, setSecoes] = useState(null);
  useEffect(() => {
    api.get('/public/beer/vitrine').then(r => setSecoes(r.data.secoes)).catch(() => setSecoes([]));
  }, []);

  if (secoes === null) {
    return <div className="h-72 rounded-2xl animate-pulse" style={{ backgroundColor: BEER.painel }} aria-hidden="true" />;
  }
  if (!secoes.length) return null;

  return (
    <div className="space-y-7 sm:space-y-9">
      {secoes.map(s => (
        <section key={s.codigo} aria-labelledby={`vitrine-${s.codigo}`}>
          <div className="flex items-end justify-between gap-3 mb-3">
            <h2 id={`vitrine-${s.codigo}`} className="text-lg sm:text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
              <span aria-hidden="true">{s.icone}</span> {s.nome}
            </h2>
            <Link to={`/beer/categoria/${s.codigo}`} className="flex-shrink-0 inline-flex items-center gap-0.5 text-xs sm:text-sm font-bold" style={{ color: BEER.lavanda }}>
              Ver todas{s.total > s.produtos.length ? ` (${s.total})` : ''} <CaretRight size={14} weight="bold" />
            </Link>
          </div>
          {/* rolagem lateral com "encaixe"; a margem negativa deixa o card
              encostar na borda da tela no celular (dá a dica de que rola) */}
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:-mx-8 sm:px-8 lg:-mx-16 lg:px-16 scrollbar-none">
            {s.produtos.map(p => (
              <div key={p.id} className="snap-start flex-shrink-0 w-[46%] sm:w-52 lg:w-56 flex">
                <CardProduto produto={p} variante={p.destaque ? 'destaque' : 'padrao'} className="w-full" />
              </div>
            ))}
            <Link to={`/beer/categoria/${s.codigo}`} className="snap-start flex-shrink-0 w-[30%] sm:w-40 rounded-2xl flex flex-col items-center justify-center gap-1 text-sm font-bold text-center px-2"
              style={{ backgroundColor: BEER.painel, border: `1px dashed ${BEER.borda}`, color: BEER.lavanda }}>
              <span className="text-3xl" aria-hidden="true">{s.icone}</span>
              Ver todas <CaretRight size={16} weight="bold" />
            </Link>
          </div>
        </section>
      ))}
    </div>
  );
}
