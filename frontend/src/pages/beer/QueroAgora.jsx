import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CabecalhoBeer, GradeProdutos, Vazio } from './BeerLayout';
import { useProdutosBeer } from './useProdutosBeer';
import { BEER } from './beerConfig';

const FILTROS = [
  { id: 'todos', label: 'Todos', params: {} },
  { id: '30', label: 'Até 30 min', params: { tempo: 30 } },
  { id: '45', label: 'Até 45 min', params: { tempo: 45 } },
  { id: 'retirada', label: 'Retirada', params: { retirada: true } },
];

// /beer/quero-agora — só o que o parceiro marcou "disponível agora", de
// quem está com "Aberto agora" ligado e que vale HOJE (backend
// getQueroAgora). O pedido abre no WhatsApp com o texto "Quero AGORA".
export default function QueroAgora() {
  const [filtro, setFiltro] = useState('todos');
  const { produtos, carregando, erro, tentarDeNovo } = useProdutosBeer(
    '/public/beer/produtos/quero-agora', FILTROS.find(f => f.id === filtro).params,
  );

  return (
    <>
      <CabecalhoBeer titulo="⚡ QUERO AGORA" subtitulo="Entrega imediata em Itumbiara" />
      <main className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full py-5 sm:py-8">
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          {FILTROS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className="flex-shrink-0 text-xs sm:text-sm font-semibold px-4 py-2 rounded-full"
              style={filtro === f.id
                ? { backgroundColor: BEER.violeta, color: '#fff', border: `1px solid ${BEER.violeta}` }
                : { color: BEER.lavanda, border: `1px solid ${BEER.borda}`, backgroundColor: 'rgba(255,255,255,0.04)' }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <p className="mt-4 mb-3 text-xs" style={{ color: BEER.lavandaFraca }}>
          {!carregando && !erro && `${produtos.length} produto${produtos.length === 1 ? '' : 's'} pra agora`}
        </p>

        <GradeProdutos
          produtos={produtos}
          carregando={carregando}
          erro={erro}
          onTentarDeNovo={tentarDeNovo}
          agora
          vazio={(
            <Vazio
              emoji="🧊"
              titulo={filtro === 'todos' ? 'Ninguém com entrega imediata agora' : 'Nada com esse filtro agora'}
              texto="Os estabelecimentos ligam o “Aberto agora” quando estão atendendo. Dá uma olhada no cardápio completo enquanto isso."
              acao={<Link to="/beer" className="text-sm font-bold px-5 py-2.5 rounded-xl text-white inline-block" style={{ backgroundColor: BEER.violeta }}>Ver todas as categorias</Link>}
            />
          )}
        />
      </main>
    </>
  );
}
