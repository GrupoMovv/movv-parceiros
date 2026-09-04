import CardProduto from './CardProduto';
import BotaoVerTodos from './BotaoVerTodos';
import Reveal from './Reveal';
import { PRETO, ROXO } from '../theme';

const MAX_VISIVEIS = 12; // "grid de 2 linhas" no desktop (6 colunas x 2)

function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="h-[140px] sm:h-[180px] rounded-md bg-slate-100" />
      <div className="h-2.5 bg-slate-100 rounded-full mt-2 w-1/2" />
      <div className="h-3.5 bg-slate-100 rounded-full mt-1.5 w-5/6" />
      <div className="h-4 bg-slate-100 rounded-full mt-1.5 w-2/3" />
    </div>
  );
}

// Seção de vitrine reutilizada em todas as listas de produto da home — grid
// denso (2 colunas no mobile, até 6 no desktop), sem scroll horizontal:
// prioriza "ver muita coisa de uma vez" sobre a experiência de carrossel.
export default function SecaoProdutos({ id, titulo, subtitulo, Icone, produtos, carregando, badge, verTodosHref, className = '', CardComponent = CardProduto }) {
  // Mesmo vazia, a seção não pode sumir de vez: se ela tem um `id` usado
  // pelo menu do topo (ex: #ofertas), sumir com o elemento inteiro faz o
  // link virar clique morto.
  if (!carregando && produtos.length === 0) return id ? <div id={id} className="scroll-mt-16" /> : null;

  const visiveis = carregando ? [] : produtos.slice(0, MAX_VISIVEIS);

  return (
    <Reveal className={className}>
      <section id={id} className="scroll-mt-16">
        <div className="flex items-end justify-between gap-4 mb-3">
          <div>
            {subtitulo && <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">{subtitulo}</p>}
            <h2 className="flex items-center gap-1.5 text-lg font-bold tracking-tight" style={{ color: PRETO }}>
              {Icone && <Icone size={20} weight="duotone" color={ROXO} />} {titulo}
            </h2>
          </div>
          {verTodosHref && !carregando && produtos.length > MAX_VISIVEIS && <BotaoVerTodos href={verTodosHref} />}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {carregando
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : visiveis.map(p => <CardComponent key={p.id} produto={p} badge={badge} />)}
        </div>
      </section>
    </Reveal>
  );
}
