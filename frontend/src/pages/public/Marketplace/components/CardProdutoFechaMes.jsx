import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import { Fire, ShoppingCart, Check } from '@phosphor-icons/react';
import { DOURADO, DOURADO_ESCURO, PRETO } from '../theme';
import { useCarrinho } from '../CarrinhoContext';

const VERMELHO = '#DC2626';

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Card exclusivo da vitrine "Ofertas Fecha Mês" — mesma base do
// CardProdutoGrande, mas com borda dourada + badge "FECHA MÊS" (o produto
// já vem com o preço promocional calculado pelo backend, não recalcula
// nada aqui). `produto` aqui é a forma que vem de /fecha-mes/produtos:
// preco_original/preco_fecha_mes, não preco/preco_associado.
export default function CardProdutoFechaMes({ produto }) {
  const foto = produto.fotos?.[0]?.url;
  const { adicionar, remover, estaNoCarrinho } = useCarrinho();
  const noCarrinho = estaNoCarrinho(produto.id);

  function handleCarrinho(e) {
    e.preventDefault();
    e.stopPropagation();
    if (noCarrinho) remover(produto.id);
    else adicionar(produto.id);
  }

  return (
    <Link
      to={`/marketplace/produto/${produto.id}`}
      className="group flex flex-col bg-white rounded-lg p-3 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 ease-out"
      style={{ border: `2px solid ${DOURADO}` }}
    >
      <div className="relative w-full h-[130px] sm:h-[150px] xl:h-[180px] rounded-lg overflow-hidden bg-white flex items-center justify-center">
        {foto ? (
          <img src={foto} alt={produto.nome} loading="lazy" className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-200 bg-slate-50">
            <ImageOff className="w-8 h-8" />
          </div>
        )}

        <span
          className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide text-white"
          style={{ background: `linear-gradient(135deg, ${VERMELHO} 0%, ${DOURADO_ESCURO} 100%)` }}
        >
          <Fire size={9} weight="fill" /> Fecha Mês
        </span>
        {produto.desconto_pct > 0 && (
          <span
            className="absolute top-1.5 right-1.5 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            -{produto.desconto_pct}%
          </span>
        )}
      </div>

      <div className="pt-2 flex-1 flex flex-col">
        <p className="text-xs text-gray-500 truncate">{produto.parceiro_nome}</p>
        <p className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.4em] mt-0.5" style={{ color: PRETO }}>
          {produto.nome}
        </p>

        <div className="mt-1.5">
          <p className="text-gray-400 text-xs line-through">{formatarPreco(produto.preco_original)}</p>
          <p className="font-black text-lg leading-tight" style={{ color: VERMELHO }}>{formatarPreco(produto.preco_fecha_mes)}</p>
        </div>

        <button
          type="button"
          onClick={handleCarrinho}
          className={`mt-2 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-md border transition-colors ${
            noCarrinho ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'hover:bg-amber-50'
          }`}
          style={noCarrinho ? {} : { borderColor: DOURADO_ESCURO, color: DOURADO_ESCURO }}
        >
          {noCarrinho ? <><Check size={12} weight="bold" /> No carrinho</> : <><ShoppingCart size={12} weight="bold" /> Adicionar</>}
        </button>
      </div>
    </Link>
  );
}
