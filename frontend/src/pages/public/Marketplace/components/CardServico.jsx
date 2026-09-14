import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import SeloPlano from './SeloPlano';
import { ROXO, PRETO } from '../theme';

// Card de prestador de serviço (não SKU) — um card = um parceiro, não um
// item de catálogo, já que "produto" de um serviço é a consulta/sessão
// em si, cadastrada (se cadastrada) em sindicato_parceiro_produtos e
// mostrada na página individual, não aqui na listagem.
export default function CardServico({ servico }) {
  const categoria = servico.categoria_principal || servico.categorias?.[0] || null;

  return (
    <Link
      to={`/servicos/${servico.slug}`}
      className="group flex flex-col bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out"
    >
      <div className="relative w-full h-[120px] sm:h-[150px] rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
        {servico.logo_url ? (
          <img src={servico.logo_url} alt={servico.nome} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <ImageOff className="w-7 h-7 text-slate-200" />
        )}
        <SeloPlano plano={servico.plano} size="sm" className="absolute top-1.5 left-1.5 shadow" />
      </div>

      <div className="pt-2.5 flex-1 flex flex-col">
        {categoria && (
          <p className="text-[10px] font-bold uppercase tracking-wide truncate" style={{ color: ROXO }}>{categoria}</p>
        )}
        <p className="text-sm font-bold leading-snug line-clamp-2 min-h-[2.4em] mt-0.5" style={{ color: PRETO }}>
          {servico.nome}
        </p>

        <div className="mt-1.5 min-h-[2em]">
          {servico.preco_medio && <p className="text-sm font-black" style={{ color: ROXO }}>{servico.preco_medio}</p>}
          {servico.duracao_media && <p className="text-[11px] text-slate-400">⏱ {servico.duracao_media}</p>}
        </div>

        <span
          className="mt-2 flex items-center justify-center text-[11px] font-bold py-1.5 rounded-lg border transition-colors group-hover:bg-purple-50"
          style={{ borderColor: ROXO, color: ROXO }}
        >
          Ver detalhes
        </span>
      </div>
    </Link>
  );
}
