import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import FiltroCategorias from '../../components/beer/FiltroCategorias';
import { CabecalhoBeer, GradeProdutos, Vazio } from './BeerLayout';
import { useProdutosBeer } from './useProdutosBeer';
import { BEER } from './beerConfig';

// /beer/categoria/:codigo — aceita GRUPO ("cervejas", com chips das
// subcategorias) ou FOLHA ("vodka"). Produtos de todos os estabelecimentos,
// com "Disponível hoje" pra quem quer a domingueira sem ver o que é só de
// outro dia.
export default function CategoriaLista() {
  const { codigo } = useParams();
  const { categorias } = useOutletContext();
  const [sub, setSub] = useState(null);
  const [soHoje, setSoHoje] = useState(false);
  useEffect(() => { setSub(null); }, [codigo]);

  const { grupo, folha } = useMemo(() => {
    for (const g of categorias || []) {
      if (g.codigo === codigo) return { grupo: g, folha: null };
      const f = g.filhas.find(x => x.codigo === codigo);
      if (f) return { grupo: g, folha: f };
    }
    return { grupo: null, folha: null };
  }, [categorias, codigo]);

  const filtro = folha ? codigo : (sub || codigo);
  const { produtos, carregando, erro, tentarDeNovo } = useProdutosBeer(
    grupo ? '/public/beer/produtos' : null, { categoria: filtro, ...(soHoje ? { dia: 'hoje' } : {}) },
  );

  if (categorias && !grupo) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full py-10">
        <Vazio emoji="🔎" titulo="Categoria não encontrada" acao={<Link to="/beer" className="text-sm font-bold px-5 py-2.5 rounded-xl text-white inline-block" style={{ backgroundColor: BEER.violeta }}>Voltar pro Disk Bebidas</Link>} />
      </main>
    );
  }

  const titulo = grupo ? `${grupo.icone} ${folha ? folha.nome : grupo.nome}` : '…';
  return (
    <>
      <CabecalhoBeer
        titulo={titulo}
        subtitulo={folha ? grupo.nome : `${grupo?.filhas.length || 0} tipos`}
        voltar={folha ? `/beer/categoria/${grupo.codigo}` : '/beer'}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full py-5 sm:py-8">
        {grupo?.regulamentada && (
          <p className="mb-4 text-xs rounded-xl px-4 py-3" style={{ color: '#FCA5A5', backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
            Categoria regulamentada. Venda proibida para menores de 18 anos — o estabelecimento confere documento na entrega.
          </p>
        )}
        {!folha && grupo && (
          <FiltroCategorias
            opcoes={grupo.filhas.map(f => ({ codigo: f.codigo, nome: f.nome }))}
            ativa={sub}
            onSelecionar={setSub}
            rotuloTodas={`Todos de ${grupo.nome}`}
          />
        )}
        <div className="mt-4 mb-3 flex items-center justify-between gap-3">
          <p className="text-xs" style={{ color: BEER.lavandaFraca }}>
            {!carregando && !erro && `${produtos.length} produto${produtos.length === 1 ? '' : 's'}`}
          </p>
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: BEER.lavanda }}>
            <input type="checkbox" checked={soHoje} onChange={e => setSoHoje(e.target.checked)} className="accent-violet-500" />
            Disponível hoje
          </label>
        </div>
        <GradeProdutos
          produtos={produtos}
          carregando={carregando || !categorias}
          erro={erro}
          onTentarDeNovo={tentarDeNovo}
          vazio={<Vazio emoji={grupo?.icone || '🥃'} titulo="Ainda sem produtos aqui" texto="Assim que os estabelecimentos cadastrarem, aparece nesta página." />}
        />
      </main>
    </>
  );
}
