import { WhatsappLogo, Lightning, Star } from '@phosphor-icons/react';
import BadgeAberto from './BadgeAberto';
import { formatarBRL } from '../../utils/iubFood';
import { BEER, linkPedido, percentualDesconto, textoDias } from '../../pages/beer/beerConfig';
import { useProdutoModal } from '../../pages/beer/produtoModalContext';

// Card de produto do Disk Bebidas. Clique no card abre o modal do produto
// (ModalProduto via BeerLayout); o botão de pedido vai direto pro WhatsApp.
// `variante`: 'padrao' | 'destaque' (selo dourado, foto maior) | 'oferta'
// (selo vermelho, preço riscado em evidência). Oferta ativa mostra o
// preço riscado em QUALQUER variante. `agora` = texto "Quero AGORA".
export default function CardProduto({ produto: p, agora = false, mostrarEstabelecimento = true, variante = 'padrao', className = '' }) {
  const { abrirProduto } = useProdutoModal();
  const link = linkPedido(p, { agora });
  const dias = textoDias(p.dias_disponiveis);
  const pct = percentualDesconto(p);
  const e = p.estabelecimento || {};
  const destaque = variante === 'destaque';
  const oferta = variante === 'oferta';

  return (
    <article
      className={`group flex flex-col rounded-2xl overflow-hidden cursor-pointer transition-transform hover:-translate-y-0.5 ${className}`}
      style={{
        backgroundColor: BEER.card,
        border: `1px solid ${destaque ? 'rgba(255,184,0,0.45)' : oferta ? 'rgba(248,113,113,0.45)' : BEER.borda}`,
        boxShadow: destaque ? '0 18px 44px rgba(76,29,149,0.55)' : '0 16px 36px rgba(0,0,0,0.45)',
      }}
      onClick={() => abrirProduto(p)}
      onKeyDown={ev => { if (ev.key === 'Enter') abrirProduto(p); }}
      tabIndex={0}
      role="button"
      aria-label={`Ver ${p.nome}`}
    >
      <div className={`relative flex items-center justify-center ${destaque ? 'h-40 sm:h-52' : 'h-32 sm:h-40'}`} style={{ backgroundColor: BEER.painel }}>
        {p.imagem
          ? <img src={p.imagem} alt={p.nome} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          : <span className={destaque ? 'text-5xl' : 'text-4xl'} aria-hidden="true">{p.categoria?.icone || '🍻'}</span>}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {destaque && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: BEER.dourado, color: '#0F0F14' }}>
              <Star size={10} weight="fill" /> DESTAQUE
            </span>
          )}
          {pct && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: '#DC2626', color: '#fff' }}>🔥 OFERTA -{pct}%</span>
          )}
          {p.disponivel_agora && !oferta && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: BEER.violeta, color: '#fff' }}>
              <Lightning size={10} weight="fill" /> Disponível agora
            </span>
          )}
          {dias && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: BEER.lavanda }}>{dias}</span>}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-3 sm:p-4">
        {p.categoria?.nome && <p className="text-[10px] font-bold uppercase tracking-[1.5px] truncate" style={{ color: BEER.lavandaFraca }}>{p.categoria.nome}</p>}
        <h3 className="mt-0.5 text-sm sm:text-base font-bold text-white leading-snug line-clamp-2">{p.nome}</h3>
        <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
          <span className={`font-black ${oferta ? 'text-xl' : 'text-lg'}`} style={{ fontFamily: 'Poppins, sans-serif', color: pct ? '#FCA5A5' : '#fff' }}>{formatarBRL(p.preco)}</span>
          {pct && <span className="text-xs line-through" style={{ color: BEER.lavandaFraca }}>{formatarBRL(p.preco_original)}</span>}
        </div>

        {p.categoria?.regulamentada && (
          <p className="mt-1 text-[10px] leading-snug" style={{ color: '#FCA5A5' }}>Venda proibida para menores de 18 anos. O Ministério da Saúde adverte: fumar faz mal à saúde.</p>
        )}

        {mostrarEstabelecimento && e.nome && (
          <div className="mt-2 flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold truncate" style={{ color: BEER.lavanda }}>{e.nome}</span>
            <BadgeAberto aberto={e.status_aberto} className="flex-shrink-0" />
          </div>
        )}

        <div className="mt-auto pt-3">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={ev => ev.stopPropagation()}
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold py-2.5 rounded-xl transition-opacity hover:opacity-90"
              style={agora || oferta || destaque ? { backgroundColor: BEER.dourado, color: '#0F0F14' } : { backgroundColor: '#16A34A', color: '#fff' }}
            >
              <WhatsappLogo size={16} weight="fill" /> {agora || oferta || destaque ? 'Pedir agora' : 'Pedir'}
            </a>
          ) : (
            <span className="w-full inline-flex justify-center text-xs py-2.5 rounded-xl" style={{ color: BEER.lavandaFraca, border: `1px solid ${BEER.borda}` }}>WhatsApp indisponível</span>
          )}
        </div>
      </div>
    </article>
  );
}
