import CardProduto from './CardProduto';
import BotaoVerTodos from './BotaoVerTodos';
import Reveal from './Reveal';
import { PRETO } from '../theme';

function SkeletonCard() {
  return (
    <div className="w-full sm:w-auto flex-shrink-0 animate-pulse" style={{ width: 'clamp(140px, 42vw, 220px)' }}>
      <div className="aspect-square rounded-2xl bg-slate-100" />
      <div className="h-3.5 bg-slate-100 rounded-full mt-2.5 w-5/6" />
      <div className="h-3.5 bg-slate-100 rounded-full mt-1.5 w-1/2" />
    </div>
  );
}

// Seção de vitrine reutilizada em todas as listas de produto da home. Regras
// de layout combinadas no Bloco 8: 1-2 produtos centraliza (sem scroll), 3+
// vira scroll horizontal com "peek" no mobile e grid no desktop.
export default function SecaoProdutos({ id, titulo, subtitulo, emoji, produtos, carregando, badge, verTodosHref, className = '', CardComponent = CardProduto }) {
  if (!carregando && produtos.length === 0) return null;

  const poucosItens = !carregando && produtos.length <= 2;

  return (
    <Reveal className={className}>
      <section id={id} className="scroll-mt-[70px]">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            {subtitulo && <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{subtitulo}</p>}
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: PRETO }}>{emoji ? `${emoji} ${titulo}` : titulo}</h2>
          </div>
          {verTodosHref && !carregando && produtos.length >= 8 && <BotaoVerTodos href={verTodosHref} />}
        </div>

        {carregando ? (
          <div className="flex gap-4 overflow-x-hidden">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : poucosItens ? (
          <div className="flex flex-wrap justify-center sm:justify-start gap-4">
            {produtos.map(p => (
              <CardComponent key={p.id} produto={p} badge={badge} className="w-[200px]" />
            ))}
          </div>
        ) : (
          <>
            {/* mobile: scroll horizontal com peek do próximo card */}
            <div className="flex sm:hidden gap-3.5 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1" style={{ scrollSnapType: 'x mandatory' }}>
              {produtos.map(p => (
                <CardComponent key={p.id} produto={p} badge={badge} className="flex-shrink-0" style={{ width: '42vw', scrollSnapAlign: 'start' }} />
              ))}
            </div>
            {/* tablet/desktop: grid */}
            <div className="hidden sm:grid grid-cols-3 lg:grid-cols-4 gap-6">
              {produtos.map(p => (
                <CardComponent key={p.id} produto={p} badge={badge} />
              ))}
            </div>
          </>
        )}
      </section>
    </Reveal>
  );
}
