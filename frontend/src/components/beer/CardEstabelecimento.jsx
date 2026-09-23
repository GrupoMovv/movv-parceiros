import { Link } from 'react-router-dom';
import { Wine, MapPin, ArrowRight } from '@phosphor-icons/react';
import SeloPlano from '../../pages/public/Marketplace/components/SeloPlano';
import { statusFuncionamento } from '../../utils/iubFood';
import { BEER, TIPOS_ESTABELECIMENTO, labelCategoria } from '../../pages/beer/beerConfig';

// Card de estabelecimento do IUB BEER. O TAMANHO segue o plano (Master
// grande, Premium médio, Oficial padrão, Grátis compacto) — é o que o
// parceiro compra ao subir de plano, além de vir antes na lista (ordem já
// vem do backend). `estabelecimento.plano` é o plano efetivo (vencido =
// gratis), calculado no backend.

function textoBairros(e) {
  const lista = e.bairros_entrega?.length ? e.bairros_entrega : (e.bairro ? [e.bairro] : []);
  if (!lista.length) return null;
  const prefixo = e.bairros_entrega?.length ? 'Entrega: ' : '';
  return prefixo + (lista.length > 3 ? `${lista.slice(0, 3).join(', ')} +${lista.length - 3}` : lista.join(', '));
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

function BadgeStatus({ status }) {
  if (!status) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: status.aberto ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.15)', color: status.aberto ? '#86EFAC' : '#FCA5A5' }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.aberto ? '#22C55E' : '#EF4444' }} />
      {status.aberto ? 'Aberto' : 'Fechado'}
    </span>
  );
}

function Info({ e, status, grande }) {
  const tipo = TIPOS_ESTABELECIMENTO[e.beer_tipo] || e.categoria_principal || null;
  const bairros = textoBairros(e);
  const categorias = (e.categorias_bebida || []).map(labelCategoria).filter(Boolean);
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {tipo && <span className="text-[10px] font-bold uppercase tracking-[2px]" style={{ color: BEER.lavanda }}>{tipo}</span>}
        <BadgeStatus status={status} />
      </div>
      <p className={`font-black text-white leading-tight mt-1 ${grande ? 'text-xl sm:text-2xl' : 'text-base line-clamp-2'}`} style={{ fontFamily: 'Poppins, sans-serif' }}>
        {e.nome}
      </p>
      {bairros && (
        <p className="text-xs mt-1.5 flex items-center gap-1 truncate" style={{ color: 'rgba(196,181,253,0.75)' }}>
          <MapPin size={12} weight="fill" className="flex-shrink-0" /> <span className="truncate">{bairros}</span>
        </p>
      )}
      {status && <p className="text-[11px] mt-1" style={{ color: 'rgba(196,181,253,0.6)' }}>{status.texto}</p>}
      {categorias.length > 0 && (
        <p className="mt-2 text-base tracking-wide" title={categorias.map(c => c.label).join(', ')}>
          {categorias.slice(0, grande ? 9 : 5).map(c => <span key={c.chave} aria-label={c.label}>{c.emoji} </span>)}
        </p>
      )}
    </>
  );
}

const BOTAO = 'inline-flex items-center justify-center gap-1.5 font-bold rounded-xl transition-colors';

export default function CardEstabelecimento({ estabelecimento: e }) {
  const status = statusFuncionamento(e.horario_funcionamento);
  const destino = `/beer/${e.slug}`;
  const moldura = { backgroundColor: BEER.card, border: `1px solid ${BEER.borda}`, boxShadow: '0 18px 40px rgba(0,0,0,0.45)' };

  if (e.plano === 'master') {
    return (
      <Link to={destino} className="group flex flex-col sm:flex-row rounded-3xl overflow-hidden hover:-translate-y-0.5 transition-transform" style={{ ...moldura, boxShadow: '0 24px 60px rgba(76,29,149,0.55)', borderColor: 'rgba(255,184,0,0.35)' }}>
        <Logo e={e} className="w-full sm:w-2/5 h-48 sm:h-auto sm:min-h-[220px]" />
        <div className="flex-1 p-5 sm:p-7 flex flex-col">
          <SeloPlano plano={e.plano} className="self-start mb-3" />
          <Info e={e} status={status} grande />
          <div className="mt-auto pt-5">
            <span className={`${BOTAO} px-5 py-2.5 text-sm`} style={{ backgroundColor: BEER.dourado, color: '#0F0F14' }}>
              Ver bebidas <ArrowRight size={15} weight="bold" />
            </span>
          </div>
        </div>
      </Link>
    );
  }

  if (e.plano === 'gratis') {
    return (
      <Link to={destino} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-white/5 transition-colors" style={{ ...moldura, boxShadow: '0 8px 20px rgba(0,0,0,0.35)' }}>
        <Logo e={e} className="w-14 h-14 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{e.nome}</p>
          <p className="text-[11px] truncate" style={{ color: 'rgba(196,181,253,0.7)' }}>
            {[TIPOS_ESTABELECIMENTO[e.beer_tipo], textoBairros(e)].filter(Boolean).join(' · ') || 'Bebidas'}
          </p>
        </div>
        <span className={`${BOTAO} px-3 py-1.5 text-[11px] flex-shrink-0`} style={{ color: BEER.lavanda, border: `1px solid ${BEER.borda}` }}>
          Ver bebidas
        </span>
      </Link>
    );
  }

  // premium (médio) e oficial (padrão): mesmo layout vertical, muda a altura da foto
  const premium = e.plano === 'premium';
  return (
    <Link to={destino} className="group flex flex-col rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-transform" style={moldura}>
      <div className="relative">
        <Logo e={e} className={`w-full ${premium ? 'h-40 sm:h-44' : 'h-28 sm:h-32'}`} />
        <SeloPlano plano={e.plano} className="absolute top-2 left-2 shadow" />
      </div>
      <div className="flex-1 p-4 flex flex-col">
        <Info e={e} status={status} />
        <div className="mt-auto pt-4">
          <span className={`${BOTAO} w-full py-2 text-xs`} style={{ color: '#fff', backgroundColor: BEER.violeta }}>
            Ver bebidas
          </span>
        </div>
      </div>
    </Link>
  );
}
