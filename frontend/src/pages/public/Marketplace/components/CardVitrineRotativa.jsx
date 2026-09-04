import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import { Diamond } from '@phosphor-icons/react';
import { ROXO, DOURADO, PRETO } from '../theme';

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Único card do marketplace com DOIS destinos de clique diferentes: a foto
// e o nome do produto levam pro produto, o nome do parceiro leva pro
// perfil dele — pedido explícito da vitrine rotativa (o resto do site usa
// CardProduto, que é um <Link> só).
export default function CardVitrineRotativa({ produto }) {
  const foto = produto.fotos?.[0]?.url;
  const temPrecoAssociado = Boolean(produto.preco_associado);
  const descontoPct = temPrecoAssociado
    ? Math.round((1 - parseFloat(produto.preco_associado) / parseFloat(produto.preco)) * 100)
    : null;

  return (
    <div className="flex flex-col bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 h-full">
      <Link to={`/marketplace/produto/${produto.id}`} className="block group">
        <div className="relative w-full h-[200px] sm:h-[240px] lg:h-[260px] rounded-lg overflow-hidden bg-white flex items-center justify-center">
          {foto ? (
            <img src={foto} alt={produto.nome} loading="lazy" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-200 bg-slate-50">
              <ImageOff className="w-10 h-10" />
            </div>
          )}
          {descontoPct > 0 && (
            <span className="absolute top-2 left-2 text-sm font-black px-3 py-1 rounded uppercase tracking-wide" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>
              -{descontoPct}% OFF
            </span>
          )}
        </div>

        <p className="text-base font-medium leading-snug line-clamp-2 min-h-[2.6em] mt-3 group-hover:underline" style={{ color: PRETO }}>
          {produto.nome}
        </p>
      </Link>

      <Link to={`/marketplace/parceiro/${produto.parceiro_slug}`} className="text-sm text-gray-500 hover:text-gray-700 hover:underline truncate w-fit">
        {produto.parceiro_nome}
      </Link>

      <div className="mt-2">
        {temPrecoAssociado ? (
          <>
            <p className="text-gray-400 text-sm line-through">{formatarPreco(produto.preco)}</p>
            <p className="font-bold text-xl leading-tight" style={{ color: ROXO }}>{formatarPreco(produto.preco_associado)}</p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold mt-1" style={{ color: DOURADO }}>
              <Diamond size={11} weight="fill" /> assoc
            </span>
          </>
        ) : (
          <p className="font-bold text-xl leading-tight text-gray-900">{formatarPreco(produto.preco)}</p>
        )}
      </div>
    </div>
  );
}
