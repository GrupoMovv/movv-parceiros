import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import { Diamond, ShoppingCart, Check } from '@phosphor-icons/react';
import { ROXO, DOURADO, PRETO } from '../theme';
import { useCarrinho } from '../CarrinhoContext';

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ehNovo(criadoEm) {
  return Date.now() - new Date(criadoEm).getTime() < SETE_DIAS_MS;
}

// Versão maior do CardProduto, só pras vitrines horizontais da home (Ofertas
// do Dia, Mais Vendidos, Novidades, Exclusivos Associados) — depois que o
// banner virou full-width e mais alto, o CardProduto compacto original
// ficou pequeno demais perto dele. É um componente à parte (não um "modo
// grande" do CardProduto) de propósito: a página de categoria e a busca
// usam o CardProduto original direto, sem passar pela SecaoProdutos, então
// mudar o tamanho aqui nunca afeta essas outras telas.
export default function CardProdutoGrande({ produto, badge, className = '', style }) {
  const foto = produto.fotos?.[0]?.url;
  const temPrecoAssociado = Boolean(produto.preco_associado);
  const mostrarNovo = badge === 'novo' && ehNovo(produto.created_at);
  const descontoPct = temPrecoAssociado
    ? Math.round((1 - parseFloat(produto.preco_associado) / parseFloat(produto.preco)) * 100)
    : produto.desconto_pct;
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
      style={style}
      className={`group flex flex-col bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 ease-out ${className}`}
    >
      <div className="relative w-full h-[200px] sm:h-[240px] lg:h-[260px] rounded-lg overflow-hidden bg-white flex items-center justify-center">
        {foto ? (
          <img
            src={foto} alt={produto.nome} loading="lazy"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-200 bg-slate-50">
            <ImageOff className="w-10 h-10" />
          </div>
        )}

        {descontoPct > 0 && (
          <span
            className="absolute top-2 left-2 text-sm font-black px-3 py-1 rounded uppercase tracking-wide"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            -{descontoPct}% OFF
          </span>
        )}
        {mostrarNovo && (
          <span className="absolute top-2 right-2 text-sm font-black px-3 py-1 rounded uppercase tracking-wide text-white" style={{ backgroundColor: '#16A34A' }}>
            Novo
          </span>
        )}
      </div>

      <div className="pt-3 flex-1 flex flex-col">
        <p className="text-sm text-gray-500 truncate">{produto.parceiro_nome}</p>
        <p className="text-base font-medium leading-snug line-clamp-2 min-h-[2.6em] mt-0.5" style={{ color: PRETO }}>
          {produto.nome}
        </p>

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

        <button
          type="button"
          onClick={handleCarrinho}
          className={`mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold py-2 rounded-md border transition-colors ${
            noCarrinho ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'hover:bg-purple-50'
          }`}
          style={noCarrinho ? {} : { borderColor: ROXO, color: ROXO }}
        >
          {noCarrinho ? <><Check size={14} weight="bold" /> No carrinho</> : <><ShoppingCart size={14} weight="bold" /> Adicionar</>}
        </button>
      </div>
    </Link>
  );
}
