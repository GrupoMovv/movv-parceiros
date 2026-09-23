import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MagnifyingGlass } from '@phosphor-icons/react';
import api from '../../services/api';
import CardEstabelecimento from '../../components/beer/CardEstabelecimento';
import { CabecalhoBeer, GradeProdutos, Vazio } from './BeerLayout';
import { useProdutosBeer } from './useProdutosBeer';
import { BEER } from './beerConfig';

function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// /beer/busca?q=texto — produtos (nome, descrição, categoria, loja; busca
// no backend) + estabelecimentos cujo NOME casa (filtro aqui, a lista de
// estabelecimentos de uma cidade é pequena).
export default function BuscaResultado() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [texto, setTexto] = useState(q);
  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const { produtos, carregando, erro, tentarDeNovo } = useProdutosBeer(q ? '/public/beer/produtos' : null, { q });

  useEffect(() => { setTexto(q); }, [q]);
  useEffect(() => {
    if (!q) { setEstabelecimentos([]); return; }
    api.get('/public/beer/estabelecimentos')
      .then(res => setEstabelecimentos(res.data.estabelecimentos.filter(e => normalizar(e.nome).includes(normalizar(q)))))
      .catch(() => setEstabelecimentos([]));
  }, [q]);

  function enviar(e) {
    e.preventDefault();
    if (texto.trim()) navigate(`/beer/busca?q=${encodeURIComponent(texto.trim())}`);
  }

  return (
    <>
      <CabecalhoBeer titulo="Buscar" subtitulo={q ? `Resultados para “${q}”` : 'Bebidas, petiscos, gelo, comida pronta…'} />
      <main className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full py-5 sm:py-8 space-y-6">
        <form onSubmit={enviar} className="flex items-center gap-2.5 rounded-2xl px-4 py-3" style={{ backgroundColor: BEER.painel, border: `1px solid ${BEER.borda}` }}>
          <MagnifyingGlass size={18} color={BEER.lavanda} />
          <input
            type="search"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Buscar bebidas, petiscos…"
            aria-label="Buscar no Disk Bebidas"
            autoFocus={!q}
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-violet-300/50"
          />
        </form>

        {q && estabelecimentos.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[2px]" style={{ color: BEER.lavandaFraca }}>Estabelecimentos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {estabelecimentos.map(e => <CardEstabelecimento key={e.id} estabelecimento={{ ...e, plano: 'gratis' }} />)}
            </div>
          </section>
        )}

        {q && (
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[2px]" style={{ color: BEER.lavandaFraca }}>
              Produtos{!carregando && !erro ? ` (${produtos.length})` : ''}
            </h2>
            <GradeProdutos
              produtos={produtos}
              carregando={carregando}
              erro={erro}
              onTentarDeNovo={tentarDeNovo}
              vazio={<Vazio emoji="🔎" titulo="Nada encontrado" texto="Tente outro nome — ex.: “cerveja”, “gelo”, “frango”." />}
            />
          </section>
        )}
      </main>
    </>
  );
}
