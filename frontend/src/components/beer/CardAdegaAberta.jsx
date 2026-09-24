import { Link } from 'react-router-dom';
import { Wine, MapPin, Truck } from '@phosphor-icons/react';
import BadgeAberto from './BadgeAberto';
import { BEER } from '../../pages/beer/beerConfig';

// Card da faixa "🏪 Adegas abertas agora" da tela de categoria (scroll
// horizontal). `estabelecimento.total_na_categoria` = quantos produtos
// DESSA categoria (com os filtros aplicados) ele tem.
export default function CardAdegaAberta({ estabelecimento: e, nomeCategoria }) {
  const bairros = e.bairros_entrega || [];
  return (
    <Link
      to={`/beer/estabelecimento/${e.slug}`}
      className="flex-shrink-0 w-64 snap-start rounded-2xl p-4 flex flex-col gap-2 hover:-translate-y-0.5 transition-transform"
      style={{ backgroundColor: BEER.card, border: `1px solid ${BEER.borda}`, boxShadow: '0 14px 32px rgba(0,0,0,0.45)' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BEER.painel }}>
          {e.logo_url ? <img src={e.logo_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <Wine size={24} color={BEER.lavanda} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">{e.nome}</p>
          <BadgeAberto aberto />
        </div>
      </div>
      {bairros.length > 0 && (
        <p className="text-[11px] flex items-start gap-1" style={{ color: BEER.lavandaFraca }}>
          <MapPin size={12} weight="fill" className="mt-0.5 flex-shrink-0" />
          <span className="line-clamp-1">{bairros.slice(0, 3).join(', ')}{bairros.length > 3 ? ` +${bairros.length - 3}` : ''}</span>
        </p>
      )}
      {e.tempo_entrega_min && (
        <p className="text-[11px] flex items-center gap-1" style={{ color: BEER.lavandaFraca }}>
          <Truck size={12} /> ~{e.tempo_entrega_min} min
        </p>
      )}
      <p className="text-xs font-semibold" style={{ color: BEER.lavanda }}>
        {e.total_na_categoria} {e.total_na_categoria === 1 ? 'produto' : 'produtos'} de {nomeCategoria.toLowerCase()}
      </p>
      <span className="mt-auto inline-flex justify-center text-xs font-bold py-2 rounded-xl text-white" style={{ backgroundColor: BEER.violeta }}>Ver bebidas</span>
    </Link>
  );
}
