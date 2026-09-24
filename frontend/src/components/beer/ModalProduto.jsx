import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, WhatsappLogo, MapPin, Clock, Wine, MagnifyingGlassPlus } from '@phosphor-icons/react';
import BadgeAberto from './BadgeAberto';
import { formatarBRL } from '../../utils/iubFood';
import { BEER, TIPOS_ESTABELECIMENTO, linkPedido, percentualDesconto, textoDias } from '../../pages/beer/beerConfig';

// Modal do produto (aberto pelo ?p=ID que o BeerLayout controla). Celular:
// tela cheia; desktop: janela sobre a página. Foto amplia no clique; ESC e
// o X fecham. `produto` null = ainda carregando (link direto).
export default function ModalProduto({ produto: p, onFechar }) {
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    const aoTeclar = e => { if (e.key === 'Escape') (zoom ? setZoom(false) : onFechar()); };
    window.addEventListener('keydown', aoTeclar);
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', aoTeclar); document.body.style.overflow = overflowAntes; };
  }, [onFechar, zoom]);

  const e = p?.estabelecimento || {};
  const link = p ? linkPedido(p) : null;
  const pct = p ? percentualDesconto(p) : null;
  const dias = p ? textoDias(p.dias_disponiveis) : null;

  return (
    <div className="fixed inset-0 z-[90] flex items-stretch sm:items-center justify-center sm:p-6 bg-black/70 backdrop-blur-sm" onClick={onFechar} role="dialog" aria-modal="true" aria-label={p?.nome || 'Produto'}>
      <div
        className="relative w-full sm:max-w-3xl sm:rounded-3xl overflow-y-auto sm:max-h-[90vh] flex flex-col sm:flex-row"
        style={{ backgroundColor: BEER.card, border: `1px solid ${BEER.borda}`, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}
        onClick={ev => ev.stopPropagation()}
      >
        <button type="button" onClick={onFechar} aria-label="Fechar" className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-black/50 text-white hover:bg-black/70">
          <X size={20} weight="bold" />
        </button>

        {!p ? (
          <div className="w-full h-96 animate-pulse" style={{ backgroundColor: BEER.painel }} />
        ) : (
          <>
            <button
              type="button"
              onClick={() => p.imagem && setZoom(true)}
              className={`relative sm:w-1/2 h-72 sm:h-auto sm:min-h-[420px] flex-shrink-0 flex items-center justify-center ${p.imagem ? 'cursor-zoom-in' : 'cursor-default'}`}
              style={{ backgroundColor: BEER.painel }}
              aria-label={p.imagem ? 'Ampliar foto' : undefined}
            >
              {p.imagem ? <img src={p.imagem} alt={p.nome} className="w-full h-full object-cover" /> : <span className="text-7xl" aria-hidden="true">{p.categoria?.icone}</span>}
              {p.imagem && <span className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/55 flex items-center justify-center text-white"><MagnifyingGlassPlus size={18} /></span>}
              {pct && <span className="absolute top-3 left-3 text-xs font-black px-2.5 py-1 rounded-full" style={{ backgroundColor: '#DC2626', color: '#fff' }}>🔥 OFERTA -{pct}%</span>}
            </button>

            <div className="flex-1 p-5 sm:p-7 flex flex-col gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[1.5px]" style={{ color: BEER.lavandaFraca }}>{p.categoria?.nome}</p>
                <h2 className="mt-1 text-xl sm:text-2xl font-black text-white leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>{p.nome}</h2>
                <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl font-black text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{formatarBRL(p.preco)}</span>
                  {p.em_oferta && p.preco_original && <span className="text-base line-through" style={{ color: BEER.lavandaFraca }}>{formatarBRL(p.preco_original)}</span>}
                </div>
                {p.em_oferta && p.oferta_ate && (
                  <p className="text-xs mt-1" style={{ color: '#FCA5A5' }}>Oferta até {new Date(p.oferta_ate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.volume_ml && <Etiqueta>{p.volume_ml >= 1000 ? `${(p.volume_ml / 1000).toLocaleString('pt-BR')} L` : `${p.volume_ml} ml`}</Etiqueta>}
                  {p.origem && <Etiqueta>{p.origem}</Etiqueta>}
                  {dias && <Etiqueta>{dias}</Etiqueta>}
                  {p.disponivel_agora && <Etiqueta destaque>⚡ Disponível agora</Etiqueta>}
                </div>
              </div>

              {p.descricao && <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: BEER.lavanda }}>{p.descricao}</p>}
              {p.categoria?.regulamentada && (
                <p className="text-[11px] leading-snug" style={{ color: '#FCA5A5' }}>Venda proibida para menores de 18 anos. O Ministério da Saúde adverte: fumar faz mal à saúde.</p>
              )}

              <div className="rounded-2xl p-4" style={{ backgroundColor: BEER.painel, border: `1px solid ${BEER.borda}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BEER.fundo }}>
                    {e.logo_url ? <img src={e.logo_url} alt="" className="w-full h-full object-cover" /> : <Wine size={24} color={BEER.lavanda} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{e.nome}</p>
                    <div className="flex items-center gap-1.5">
                      <BadgeAberto aberto={e.status_aberto} />
                      <span className="text-[11px]" style={{ color: BEER.lavandaFraca }}>{TIPOS_ESTABELECIMENTO[e.tipo]}</span>
                    </div>
                  </div>
                </div>
                {e.bairros_entrega?.length > 0 && <p className="mt-2 text-xs flex items-start gap-1" style={{ color: BEER.lavandaFraca }}><MapPin size={13} weight="fill" className="mt-0.5 flex-shrink-0" /> Entrega: {e.bairros_entrega.join(', ')}</p>}
                {e.tempo_entrega_min && <p className="mt-1 text-xs flex items-center gap-1" style={{ color: BEER.lavandaFraca }}><Clock size={13} /> ~{e.tempo_entrega_min} min{e.retirada_disponivel ? ' · retirada no local' : ''}</p>}
                <Link to={`/beer/estabelecimento/${e.slug}`} onClick={onFechar} className="mt-3 inline-block text-xs font-bold underline" style={{ color: BEER.lavanda }}>
                  Ver todas as bebidas deste parceiro →
                </Link>
              </div>

              <div className="mt-auto sticky bottom-0 pt-2 pb-1 sm:static" style={{ background: `linear-gradient(to top, ${BEER.card} 70%, transparent)` }}>
                {link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="w-full inline-flex items-center justify-center gap-2 text-base font-black py-4 rounded-2xl" style={{ backgroundColor: BEER.dourado, color: '#0F0F14' }}>
                    <WhatsappLogo size={22} weight="fill" /> PEDIR AGORA (via WhatsApp)
                  </a>
                ) : (
                  <span className="w-full inline-flex justify-center text-sm py-4 rounded-2xl" style={{ color: BEER.lavandaFraca, border: `1px solid ${BEER.borda}` }}>WhatsApp indisponível</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {zoom && p?.imagem && (
        <div className="fixed inset-0 z-[95] bg-black/95 flex items-center justify-center cursor-zoom-out" onClick={ev => { ev.stopPropagation(); setZoom(false); }}>
          <img src={p.imagem} alt={p.nome} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}

function Etiqueta({ children, destaque = false }) {
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={destaque ? { backgroundColor: BEER.violeta, color: '#fff' } : { color: BEER.lavanda, border: `1px solid ${BEER.borda}` }}>
      {children}
    </span>
  );
}
