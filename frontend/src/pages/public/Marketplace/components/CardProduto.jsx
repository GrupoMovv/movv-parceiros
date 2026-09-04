import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import { Diamond } from '@phosphor-icons/react';
import { ROXO, DOURADO, PRETO } from '../theme';

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ehNovo(criadoEm) {
  return Date.now() - new Date(criadoEm).getTime() < SETE_DIAS_MS;
}

// Card compacto e denso (estilo marketplace, não vitrine institucional) —
// imagem em object-contain (nunca corta o produto), altura fixa, pouco
// padding. `badge` escolhe o selo do canto: 'desconto' usa produto.desconto_pct
// (vem pronto do backend), 'exclusivo' é o selo dourado de associado, 'novo'
// só aparece se cadastrado há <7 dias.
export default function CardProduto({ produto, badge, className = '', style }) {
  const foto = produto.fotos?.[0]?.url;
  const temPrecoAssociado = Boolean(produto.preco_associado);
  const mostrarNovo = badge === 'novo' && ehNovo(produto.created_at);
  const descontoPct = temPrecoAssociado
    ? Math.round((1 - parseFloat(produto.preco_associado) / parseFloat(produto.preco)) * 100)
    : produto.desconto_pct;

  return (
    <Link
      to={`/marketplace/produto/${produto.id}`}
      style={style}
      className={`group flex flex-col bg-white border border-gray-100 rounded-lg p-2.5 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 ease-out ${className}`}
    >
      <div className="relative w-full h-[140px] sm:h-[180px] rounded-md overflow-hidden bg-white flex items-center justify-center">
        {foto ? (
          <img
            src={foto} alt={produto.nome} loading="lazy"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-200 bg-slate-50">
            <ImageOff className="w-7 h-7" />
          </div>
        )}

        {descontoPct > 0 && (
          <span
            className="absolute top-1.5 left-1.5 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            -{descontoPct}% OFF
          </span>
        )}
        {mostrarNovo && (
          <span className="absolute top-1.5 right-1.5 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide text-white" style={{ backgroundColor: '#16A34A' }}>
            Novo
          </span>
        )}
      </div>

      <div className="pt-2 flex-1 flex flex-col">
        <p className="text-[11px] text-gray-500 truncate">{produto.parceiro_nome}</p>
        <p className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.4em] mt-0.5" style={{ color: PRETO }}>
          {produto.nome}
        </p>

        <div className="mt-1.5">
          {temPrecoAssociado ? (
            <>
              <p className="text-gray-400 text-xs line-through">{formatarPreco(produto.preco)}</p>
              <p className="font-bold text-lg leading-tight" style={{ color: ROXO }}>{formatarPreco(produto.preco_associado)}</p>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold mt-0.5" style={{ color: DOURADO }}>
                <Diamond size={9} weight="fill" /> assoc
              </span>
            </>
          ) : (
            <p className="font-bold text-lg leading-tight text-gray-900">{formatarPreco(produto.preco)}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
