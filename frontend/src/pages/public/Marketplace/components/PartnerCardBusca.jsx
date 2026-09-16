import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import SeloPlano from './SeloPlano';
import { normalizarCategoria } from '../parceirosData';
import { ROXO, PRETO } from '../theme';

// Card de parceiro pro resultado de busca (ver getBusca no backend) —
// parceiro pode ser loja "Fase 1" (estática), prestador de serviço ou
// restaurante (IUB Food), cada um com página de detalhe própria e
// diferente. PartnerCard.jsx normal sempre linka pra
// /marketplace/parceiro/:slug (só a página estática) e mostra "5.0"
// fixo (dado fabricado, já documentado em TODO.md) — não dá pra reusar
// aqui sem herdar os dois problemas pra parceiros que vêm de verdade do
// banco (Serviços/Food nunca estão no arquivo estático).
function linkDoParceiro(p) {
  const ehAlimentacao = (p.categorias || []).some(c => normalizarCategoria(c) === normalizarCategoria('Alimentação'));
  if (ehAlimentacao) return `/food/${p.slug}`;
  if (p.tipo_negocio === 'servico' || p.tipo_negocio === 'hibrido') return `/servicos/${p.slug}`;
  return `/marketplace/parceiro/${p.slug}`;
}

export default function PartnerCardBusca({ parceiro }) {
  const categoria = parceiro.categoria_principal || parceiro.categorias?.[0] || null;

  return (
    <Link
      to={linkDoParceiro(parceiro)}
      className="group flex flex-col bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out"
    >
      <div className="relative w-full h-[120px] sm:h-[150px] rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
        {parceiro.logo_url ? (
          <img src={parceiro.logo_url} alt={parceiro.nome} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <ImageOff className="w-7 h-7 text-slate-200" />
        )}
        <SeloPlano plano={parceiro.plano} size="sm" className="absolute top-1.5 left-1.5 shadow" />
      </div>

      <div className="pt-2.5 flex-1 flex flex-col">
        {categoria && (
          <p className="text-[10px] font-bold uppercase tracking-wide truncate" style={{ color: ROXO }}>{categoria}</p>
        )}
        <p className="text-sm font-bold leading-snug line-clamp-2 min-h-[2.4em] mt-0.5" style={{ color: PRETO }}>
          {parceiro.nome}
        </p>

        <span
          className="mt-2 flex items-center justify-center text-[11px] font-bold py-1.5 rounded-lg border transition-colors group-hover:bg-purple-50"
          style={{ borderColor: ROXO, color: ROXO }}
        >
          Ver mais
        </span>
      </div>
    </Link>
  );
}
