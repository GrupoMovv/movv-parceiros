import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import { ROXO, DOURADO, PRETO } from '../theme';

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ehNovo(criadoEm) {
  return Date.now() - new Date(criadoEm).getTime() < SETE_DIAS_MS;
}

// Card padrão de produto usado em todas as vitrines da home (ofertas,
// exclusivos, novidades, mais vendidos). `badge` escolhe o selo do canto:
// 'desconto' usa produto.desconto_pct (vem pronto do backend), 'exclusivo'
// é o selo dourado de associado, 'novo' só aparece se cadastrado há <7 dias.
export default function CardProduto({ produto, badge, className = '', style }) {
  const foto = produto.fotos?.[0]?.url;
  const temPrecoAssociado = Boolean(produto.preco_associado);
  const mostrarNovo = badge === 'novo' && ehNovo(produto.created_at);

  return (
    <Link
      to={`/marketplace/produto/${produto.id}`}
      style={style}
      className={`group flex flex-col bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 ease-out hover:-translate-y-1 ${className}`}
    >
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-50">
        {foto ? (
          <img
            src={foto} alt={produto.nome} loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageOff className="w-8 h-8" />
          </div>
        )}

        {badge === 'desconto' && produto.desconto_pct && (
          <span
            className="absolute top-2.5 left-2.5 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wide shadow-sm"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            {produto.desconto_pct}% OFF
          </span>
        )}
        {badge === 'exclusivo' && (
          <span
            className="absolute top-2.5 left-2.5 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wide shadow-sm"
            style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
          >
            💎 Exclusivo
          </span>
        )}
        {mostrarNovo && (
          <span
            className="absolute top-2.5 left-2.5 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wide shadow-sm text-white"
            style={{ backgroundColor: '#16A34A' }}
          >
            Novo
          </span>
        )}
      </div>

      <div className="pt-2.5 flex-1 flex flex-col">
        <p className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5em]" style={{ color: PRETO }}>
          {produto.nome}
        </p>

        <div className="mt-1.5">
          {temPrecoAssociado ? (
            <>
              <p className="text-slate-400 text-xs line-through">{formatarPreco(produto.preco)}</p>
              <p className="font-extrabold text-base" style={{ color: ROXO }}>{formatarPreco(produto.preco_associado)}</p>
            </>
          ) : (
            <p className="font-extrabold text-base" style={{ color: PRETO }}>{formatarPreco(produto.preco)}</p>
          )}
        </div>

        <p className="text-slate-400 text-xs mt-1 truncate">{produto.parceiro_nome}</p>
      </div>
    </Link>
  );
}
