import { Link } from 'react-router-dom';
import { Wine, MapPin, ArrowRight, Clock } from '@phosphor-icons/react';
import SeloPlano from '../../pages/public/Marketplace/components/SeloPlano';
import BadgeAberto from './BadgeAberto';
import { BEER, TIPOS_ESTABELECIMENTO } from '../../pages/beer/beerConfig';

// Card de estabelecimento do Disk Bebidas. O TAMANHO segue o plano (Master
// grande, Premium médio, Oficial padrão, Grátis compacto) — é parte do que o
// parceiro compra ao subir de plano, além de vir antes na lista (a ordem já
// vem do backend). `plano` é o efetivo (vencido = gratis), calculado lá.

function textoBairros(e) {
  const lista = e.bairros_entrega || [];
  if (!lista.length) return null;
  return 'Entrega: ' + (lista.length > 3 ? `${lista.slice(0, 3).join(', ')} +${lista.length - 3}` : lista.join(', '));
}

function Logo({ e, className }) {
  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${className}`} style={{ backgroundColor: BEER.painel }}>
      {e.logo_url
        ? <img src={e.logo_url} alt={e.nome} loading="lazy" className="w-full h-full object-cover" />
        : <Wine size={36} weight="duotone" color={BEER.lavanda} />}
    </div>
  );
}

function Info({ e, grande }) {
  const bairros = textoBairros(e);
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-[2px]" style={{ color: BEER.lavanda }}>{TIPOS_ESTABELECIMENTO[e.tipo] || 'Disk bebidas'}</span>
        <BadgeAberto aberto={e.status_aberto} />
      </div>
      <p className={`font-black text-white leading-tight mt-1 ${grande ? 'text-xl sm:text-2xl' : 'text-base line-clamp-2'}`} style={{ fontFamily: 'Poppins, sans-serif' }}>
        {e.nome}
      </p>
      {bairros && (
        <p className="text-xs mt-1.5 flex items-center gap-1 min-w-0" style={{ color: BEER.lavandaFraca }}>
          <MapPin size={12} weight="fill" className="flex-shrink-0" /> <span className="truncate">{bairros}</span>
        </p>
      )}
      {e.tempo_entrega_min && (
        <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: BEER.lavandaFraca }}>
          <Clock size={12} /> Entrega em ~{e.tempo_entrega_min} min{e.retirada_disponivel ? ' · retirada no local' : ''}
        </p>
      )}
    </>
  );
}

const BOTAO = 'inline-flex items-center justify-center gap-1.5 font-bold rounded-xl';

export default function CardEstabelecimento({ estabelecimento: e }) {
  const destino = `/beer/estabelecimento/${e.slug}`;
  const moldura = { backgroundColor: BEER.card, border: `1px solid ${BEER.borda}`, boxShadow: '0 18px 40px rgba(0,0,0,0.45)' };

  if (e.plano === 'master') {
    return (
      <Link to={destino} className="group flex flex-col sm:flex-row rounded-3xl overflow-hidden hover:-translate-y-0.5 transition-transform" style={{ ...moldura, boxShadow: '0 24px 60px rgba(76,29,149,0.55)', borderColor: 'rgba(255,184,0,0.35)' }}>
        <Logo e={e} className="w-full sm:w-2/5 h-44 sm:h-auto sm:min-h-[200px]" />
        <div className="flex-1 p-5 sm:p-7 flex flex-col">
          <SeloPlano plano={e.plano} className="self-start mb-3" />
          <Info e={e} grande />
          <div className="mt-auto pt-5">
            <span className={`${BOTAO} px-5 py-2.5 text-sm`} style={{ backgroundColor: BEER.dourado, color: '#0F0F14' }}>
              Ver produtos <ArrowRight size={15} weight="bold" />
            </span>
          </div>
        </div>
      </Link>
    );
  }

  if (e.plano === 'premium' || e.plano === 'oficial') {
    const premium = e.plano === 'premium';
    return (
      <Link to={destino} className="group flex flex-col rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-transform" style={moldura}>
        <div className="relative">
          <Logo e={e} className={`w-full ${premium ? 'h-40 sm:h-44' : 'h-28 sm:h-32'}`} />
          <SeloPlano plano={e.plano} className="absolute top-2 left-2 shadow" />
        </div>
        <div className="flex-1 p-4 flex flex-col">
          <Info e={e} />
          <div className="mt-auto pt-4">
            <span className={`${BOTAO} w-full py-2 text-xs text-white`} style={{ backgroundColor: BEER.violeta }}>Ver produtos</span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={destino} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-white/5 transition-colors" style={{ ...moldura, boxShadow: '0 8px 20px rgba(0,0,0,0.35)' }}>
      <Logo e={e} className="w-14 h-14 rounded-xl flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{e.nome}</p>
        <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
          <BadgeAberto aberto={e.status_aberto} className="flex-shrink-0" />
          <span className="text-[11px] truncate" style={{ color: BEER.lavandaFraca }}>{TIPOS_ESTABELECIMENTO[e.tipo]}</span>
        </div>
      </div>
      <span className={`${BOTAO} px-3 py-1.5 text-[11px] flex-shrink-0`} style={{ color: BEER.lavanda, border: `1px solid ${BEER.borda}` }}>Ver</span>
    </Link>
  );
}
