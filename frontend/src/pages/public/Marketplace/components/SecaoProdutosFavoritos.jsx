import Reveal from './Reveal';
import CardProdutoGrande from './CardProdutoGrande';
import MascoteIubMais from '../../../../components/MascoteIubMais';
import { PRETO } from '../theme';

// Produtos favoritos (ver useFavoritos(CHAVE_FAVORITOS_PRODUTOS) em
// ProdutoDetalhe.jsx) — extraída de Marketplace.jsx pra ser reusada em
// /favoritos (ver Favoritos.jsx).
export default function SecaoProdutosFavoritos({ produtos, carregando }) {
  if (carregando) {
    return (
      <section>
        <h2 className="flex items-center gap-1.5 text-lg font-bold tracking-tight mb-4" style={{ color: PRETO }}>
          ❤️ Produtos favoritos
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[240px] rounded-lg bg-slate-100 animate-pulse" />)}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-lg font-bold tracking-tight mb-4" style={{ color: PRETO }}>
        ❤️ Produtos favoritos
      </h2>
      {produtos.length === 0 ? (
        <div className="text-center py-16">
          <MascoteIubMais tamanho="large" animacao="float" className="mx-auto" />
          <p className="text-iub-roxo font-bold text-lg mt-4">Você ainda não favoritou nenhum produto.</p>
          <p className="text-iub-cinza mt-2">Mas continua procurando, tem muita coisa boa aqui!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {produtos.map((p, i) => (
            <Reveal key={p.id} delay={(i % 10) * 40}>
              <CardProdutoGrande produto={p} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}
