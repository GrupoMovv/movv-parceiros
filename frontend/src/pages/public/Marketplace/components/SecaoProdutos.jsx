import CardProdutoGrande from './CardProdutoGrande';
import BotaoVerTodos from './BotaoVerTodos';
import Reveal from './Reveal';
import VitrinePaginada from './VitrinePaginada';
import { PRETO, ROXO } from '../theme';

// Seção de vitrine reutilizada em todas as listas de produto da home
// (Mais Vendidos, Novidades, Exclusivos, Ofertas do Dia) — grade paginada
// de 2 fileiras (VitrinePaginada cuida de colunas responsivas, setas,
// dots e auto-avanço). Só usada na home (Marketplace.jsx) — a página de
// categoria tem sua própria grade com o CardProduto compacto original.
export default function SecaoProdutos({ id, titulo, subtitulo, Icone, produtos, carregando, badge, verTodosHref, className = '', CardComponent = CardProdutoGrande }) {
  // Mesmo vazia, a seção não pode sumir de vez: se ela tem um `id` usado
  // pelo menu do topo (ex: #ofertas), sumir com o elemento inteiro faz o
  // link virar clique morto.
  if (!carregando && produtos.length === 0) return id ? <div id={id} className="scroll-mt-16" /> : null;

  return (
    <Reveal className={className}>
      <section id={id} className="scroll-mt-16">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            {subtitulo && <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{subtitulo}</p>}
            <h2 className="flex items-center gap-2 text-2xl md:text-3xl font-bold tracking-tight" style={{ color: PRETO }}>
              {Icone && <Icone size={26} weight="duotone" color={ROXO} />} {titulo}
            </h2>
          </div>
          {verTodosHref && !carregando && produtos.length > 0 && <BotaoVerTodos href={verTodosHref} />}
        </div>

        <VitrinePaginada produtos={produtos} carregando={carregando} CardComponent={CardComponent} badge={badge} />
      </section>
    </Reveal>
  );
}
