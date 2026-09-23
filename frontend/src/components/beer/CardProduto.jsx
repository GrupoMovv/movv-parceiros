import { Link } from 'react-router-dom';
import { WhatsappLogo, Wine, Lightning } from '@phosphor-icons/react';
import BadgeAberto from './BadgeAberto';
import { formatarBRL } from '../../utils/iubFood';
import { BEER, linkPedido, textoDias } from '../../pages/beer/beerConfig';

// Card de produto do Disk Bebidas (Quero Agora, categoria, busca, detalhe).
// `agora` troca o texto do pedido pro do Quero Agora; `mostrarEstabelecimento`
// esconde a linha da loja quando o card já está DENTRO da página dela.
export default function CardProduto({ produto: p, agora = false, mostrarEstabelecimento = true }) {
  const link = linkPedido(p, { agora });
  const dias = textoDias(p.dias_disponiveis);
  const e = p.estabelecimento || {};

  return (
    <article
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{ backgroundColor: BEER.card, border: `1px solid ${BEER.borda}`, boxShadow: '0 16px 36px rgba(0,0,0,0.45)' }}
    >
      <div className="relative h-32 sm:h-40 flex items-center justify-center" style={{ backgroundColor: BEER.painel }}>
        {p.imagem
          ? <img src={p.imagem} alt={p.nome} loading="lazy" className="w-full h-full object-cover" />
          : <span className="text-4xl" aria-hidden="true">{p.categoria?.icone || <Wine size={36} color={BEER.lavanda} />}</span>}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {p.disponivel_agora && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: BEER.violeta, color: '#fff' }}>
              <Lightning size={10} weight="fill" /> Disponível agora
            </span>
          )}
          {dias && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: BEER.lavanda }}>{dias}</span>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-3 sm:p-4">
        {p.categoria?.nome && (
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] truncate" style={{ color: BEER.lavandaFraca }}>{p.categoria.nome}</p>
        )}
        <h3 className="mt-0.5 text-sm sm:text-base font-bold text-white leading-snug line-clamp-2">{p.nome}</h3>
        {p.descricao && <p className="mt-1 text-xs leading-snug line-clamp-2" style={{ color: BEER.lavandaFraca }}>{p.descricao}</p>}
        <p className="mt-2 text-lg font-black text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{formatarBRL(p.preco)}</p>

        {p.categoria?.regulamentada && (
          <p className="mt-1 text-[10px] leading-snug" style={{ color: '#FCA5A5' }}>Venda proibida para menores de 18 anos. O Ministério da Saúde adverte: fumar faz mal à saúde.</p>
        )}

        {mostrarEstabelecimento && e.slug && (
          <Link to={`/beer/estabelecimento/${e.slug}`} className="mt-2 flex items-center gap-1.5 min-w-0 group">
            <span className="text-xs font-semibold truncate group-hover:underline" style={{ color: BEER.lavanda }}>{e.nome}</span>
            <BadgeAberto aberto={e.status_aberto} className="flex-shrink-0" />
          </Link>
        )}

        <div className="mt-auto pt-3">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold py-2.5 rounded-xl transition-opacity hover:opacity-90"
              style={agora ? { backgroundColor: BEER.dourado, color: '#0F0F14' } : { backgroundColor: '#16A34A', color: '#fff' }}
            >
              <WhatsappLogo size={16} weight="fill" /> {agora ? 'Pedir agora' : 'Pedir no WhatsApp'}
            </a>
          ) : (
            <span className="w-full inline-flex justify-center text-xs py-2.5 rounded-xl" style={{ color: BEER.lavandaFraca, border: `1px solid ${BEER.borda}` }}>WhatsApp indisponível</span>
          )}
        </div>
      </div>
    </article>
  );
}
